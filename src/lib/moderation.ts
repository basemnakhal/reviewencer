/**
 * UAE legal-filter moderation pipeline.
 *
 * Every review passes through Claude with a UAE-law-aware system prompt
 * that returns a structured verdict. Verdicts are:
 *   - auto_approved → review is published instantly
 *   - flagged       → queued for human moderator (MODERATION_NOTIFY_EMAIL)
 *   - rejected      → never published; user sees rationale + suggested_edit
 *
 * Legal anchors referenced in the system prompt:
 *   - UAE Federal Decree-Law No. 34 of 2021 (Combating Rumours & Cybercrimes)
 *   - UAE Penal Code — defamation, slander, insult
 *   - Article 372–374 re: invasion of privacy & publication of private info
 *
 * Output contract: strict JSON matching ModerationVerdict in types.ts.
 */
import 'server-only';
import { askClaudeJson, CLAUDE_MODEL } from '@/lib/claude';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { env } from '@/lib/env';
import type { ModerationVerdict, RiskCategory, ModerationStatus } from '@/lib/types';

const SYSTEM_PROMPT = `You are the legal-compliance moderator for Reviewencer, a UAE-based consumer review platform.

Your job: read a review submitted about a business and decide if it is safe to publish
under United Arab Emirates law — in particular:

  • Federal Decree-Law No. 34 of 2021 (Combating Rumours and Cybercrimes)
  • UAE Penal Code, articles on defamation, slander, and insult
  • UAE privacy laws (personal data of named individuals)
  • Religious and political sensitivity rules applicable in the UAE

DECISION RULES

  auto_approved — The review is a sincere, first-person account of the author's
                  own experience as a customer, expressed in civil language,
                  without unfounded accusations of crimes, no slurs, no named
                  private individuals, no religious/political content, no
                  obvious spam or fake-sounding text. Negative opinions are OK.

  flagged       — The review MIGHT be problematic and a human should look:
                  borderline strong language, accusations of specific wrongdoing
                  that lack clear personal-experience framing, heated but not
                  clearly unlawful content, references to identifiable staff
                  members by name.

  rejected      — Clearly unsafe under UAE law: accusations of specific crimes
                  (fraud, theft, etc.) presented as fact, personal insults or
                  slurs, hate speech against any protected group, religious or
                  political agitation, doxxing/private info of named individuals,
                  or obvious spam/fake content.

RISK CATEGORIES (use zero or more; use 'low_risk' if none apply):

  defamation           — accuses a named business or person of specific wrongdoing
                         without qualifying it as personal experience
  insult               — personal attack, mockery, slur
  commercial_disparage — broad negative claims about a business without personal basis
                         ("all their products are counterfeit")
  religion_politics    — religious or political commentary
  private_info         — names/discloses info about identifiable staff or customers
  hate_speech          — discrimination on race, religion, nationality, etc.
  spam_fake            — fake, promotional, or bot-generated text
  low_risk             — nothing to flag

OUTPUT FORMAT — respond with a single JSON object, nothing else:

{
  "status": "auto_approved" | "flagged" | "rejected",
  "risk_categories": ["..."],
  "rationale": "one sentence — explain the decision to the user/moderator",
  "suggested_edit": "if rejected, suggest a rewritten version that keeps the
                     author's intent but is lawful. null otherwise."
}

Keep rationale friendly and factual. The user will read it.`;

export interface ModerateArgs {
  text: string;
  rating: number;
  businessName: string;
}

/** Call Claude to classify a review. Pure function — no DB side-effects. */
export async function moderateWithClaude(args: ModerateArgs): Promise<ModerationVerdict> {
  const userMsg = [
    `Business being reviewed: ${args.businessName}`,
    `Rating given: ${args.rating}/5`,
    '',
    'Review text:',
    '---',
    args.text,
    '---',
  ].join('\n');

  // Strict mode: force everything to flagged for human review regardless of AI opinion
  if (env.MODERATION_STRICT_MODE) {
    return {
      status: 'flagged',
      risk_categories: ['low_risk'],
      rationale: 'Strict mode is on — every review is queued for manual review before publishing.',
      suggested_edit: null,
    };
  }

  const verdict = await askClaudeJson<ModerationVerdict>({
    system: SYSTEM_PROMPT,
    user: userMsg,
    maxTokens: 800,
    temperature: 0.15,
  });

  // Defensive sanitation — clamp to enum values we recognise
  return {
    status: sanitizeStatus(verdict.status),
    risk_categories: sanitizeRisks(verdict.risk_categories),
    rationale: String(verdict.rationale ?? '').slice(0, 500),
    suggested_edit: verdict.suggested_edit ? String(verdict.suggested_edit).slice(0, 2000) : null,
  };
}

/**
 * End-to-end moderation: call Claude, write moderation_status, log event,
 * and return the verdict so the submission handler can respond to the user.
 *
 * Should be called with the service-role client (already inside this fn).
 */
export async function moderateAndRecord(
  reviewId: string,
  businessName: string,
  text: string,
  rating: number,
): Promise<ModerationVerdict> {
  const verdict = await moderateWithClaude({ text, rating, businessName });

  const newStatus: ModerationStatus =
    verdict.status === 'auto_approved' ? 'published' :
    verdict.status === 'flagged'       ? 'flagged'   :
    /* rejected */                       'rejected';

  const supa = createSupabaseServiceClient();

  const { error: updErr } = await supa
    .from('reviews')
    .update({
      moderation_status:    newStatus,
      moderation_rationale: verdict.rationale,
      risk_categories:      verdict.risk_categories,
      published_at:         newStatus === 'published' ? new Date().toISOString() : null,
    })
    .eq('id', reviewId);
  if (updErr) throw updErr;

  const { error: evtErr } = await supa.from('moderation_events').insert({
    review_id:       reviewId,
    actor_id:        null,
    actor_type:      'ai',
    from_status:     'pending',
    to_status:       newStatus,
    rationale:       verdict.rationale,
    risk_categories: verdict.risk_categories,
    model:           CLAUDE_MODEL,
  });
  if (evtErr) throw evtErr;

  return verdict;
}

// ---------- internals ----------

function sanitizeStatus(s: unknown): ModerationVerdict['status'] {
  return s === 'auto_approved' || s === 'rejected' ? s : 'flagged';
}

function sanitizeRisks(r: unknown): RiskCategory[] {
  const allowed: RiskCategory[] = [
    'defamation', 'insult', 'commercial_disparage', 'religion_politics',
    'private_info', 'hate_speech', 'spam_fake', 'low_risk',
  ];
  if (!Array.isArray(r)) return ['low_risk'];
  const out = r.filter((x): x is RiskCategory => allowed.includes(x as RiskCategory));
  return out.length ? out : ['low_risk'];
}
