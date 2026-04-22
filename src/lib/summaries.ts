/**
 * AI-generated business summaries.
 *
 * Strategy: for a given business, fetch all published reviews, feed them
 * to Claude with a structured-output prompt, and upsert the result into
 * ai_summaries. The `stale` flag (set by a DB trigger on new reviews) tells
 * the rebuild job which businesses actually need refreshing.
 */
import 'server-only';
import { askClaudeJson, CLAUDE_MODEL } from '@/lib/claude';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import type { ThemeScore, AiSummary } from '@/lib/types';

interface ClaudeSummary {
  headline:   string;
  pros:       string[];
  cons:       string[];
  themes:     ThemeScore[];
  sentiment:  number; // 0..100
}

const SYSTEM_PROMPT = `You are a review analyst for Reviewencer, a UAE consumer review platform.

Given real customer reviews about a single business, produce a concise, neutral
summary that helps a new customer decide whether to use it.

STYLE
  • Tight, factual, no hype. No marketing language.
  • Reference specific experiences from the reviews; never invent details.
  • Use UAE-appropriate phrasing (AED, Dubai/Abu Dhabi/Sharjah if mentioned).
  • If reviews are mixed, say so explicitly.

OUTPUT — respond with a single JSON object, nothing else:

{
  "headline":  "one sentence, max 100 chars, captures the core takeaway",
  "pros":      ["3–5 short phrases, each max 60 chars"],
  "cons":      ["3–5 short phrases, each max 60 chars"],
  "themes":    [{"label": "short phrase", "score": 0–100}, ... up to 6],
  "sentiment": 0–100 integer — overall customer sentiment
}

Themes are recurring topics reviewers talk about (e.g. "Approval speed", "RM
responsiveness", "App reliability"). Score = how positive that theme is.`;

export async function buildSummaryWithClaude(
  businessName: string,
  reviews: { rating: number; text: string }[],
): Promise<ClaudeSummary> {
  if (reviews.length === 0) {
    return { headline: 'Not enough reviews yet.', pros: [], cons: [], themes: [], sentiment: 50 };
  }

  const formatted = reviews
    .map((r, i) => `Review #${i + 1} (${r.rating}/5): ${r.text.replace(/\s+/g, ' ').trim()}`)
    .join('\n\n');

  const user = [
    `Business: ${businessName}`,
    `Review count: ${reviews.length}`,
    '',
    formatted,
  ].join('\n');

  const summary = await askClaudeJson<ClaudeSummary>({
    system: SYSTEM_PROMPT,
    user,
    maxTokens: 1200,
    temperature: 0.2,
  });

  return sanitize(summary);
}

/**
 * Rebuild summary for a single business end-to-end: fetch published reviews,
 * call Claude, upsert into ai_summaries. Returns the fresh row.
 */
export async function rebuildSummary(businessId: string): Promise<AiSummary> {
  const supa = createSupabaseServiceClient();

  const { data: biz, error: bizErr } = await supa
    .from('businesses').select('id, name').eq('id', businessId).single();
  if (bizErr || !biz) throw bizErr ?? new Error('business not found');

  const { data: reviews, error: revErr } = await supa
    .from('reviews')
    .select('rating, text')
    .eq('business_id', businessId)
    .eq('moderation_status', 'published')
    .order('published_at', { ascending: false })
    .limit(100);
  if (revErr) throw revErr;

  const rows = reviews ?? [];
  const summary = await buildSummaryWithClaude(biz.name, rows);
  const avgRating = rows.length
    ? +(rows.reduce((a, r) => a + r.rating, 0) / rows.length).toFixed(1)
    : null;

  const upsertRow: Partial<AiSummary> = {
    business_id:  businessId,
    headline:     summary.headline,
    pros:         summary.pros,
    cons:         summary.cons,
    themes:       summary.themes,
    sentiment:    summary.sentiment,
    review_count: rows.length,
    avg_rating:   avgRating,
    generated_by: CLAUDE_MODEL,
    generated_at: new Date().toISOString(),
    stale:        false,
  };

  const { data, error } = await supa
    .from('ai_summaries')
    .upsert(upsertRow, { onConflict: 'business_id' })
    .select()
    .single();
  if (error || !data) throw error ?? new Error('upsert failed');
  return data as AiSummary;
}

/** Rebuild summaries for every business marked stale. */
export async function rebuildStaleSummaries(): Promise<string[]> {
  const supa = createSupabaseServiceClient();
  const { data, error } = await supa
    .from('ai_summaries').select('business_id').eq('stale', true);
  if (error) throw error;
  const rebuilt: string[] = [];
  for (const row of data ?? []) {
    try {
      await rebuildSummary(row.business_id);
      rebuilt.push(row.business_id);
    } catch (e) {
      console.error(`[summaries] failed to rebuild ${row.business_id}`, e);
    }
  }
  return rebuilt;
}

// ---------- internals ----------

function sanitize(s: ClaudeSummary): ClaudeSummary {
  return {
    headline:  String(s.headline ?? '').slice(0, 160),
    pros:      Array.isArray(s.pros)   ? s.pros.slice(0, 5).map(String) : [],
    cons:      Array.isArray(s.cons)   ? s.cons.slice(0, 5).map(String) : [],
    themes:    Array.isArray(s.themes)
      ? s.themes.slice(0, 6).map(t => ({
          label: String(t.label ?? '').slice(0, 40),
          score: clamp(Number(t.score) || 0, 0, 100),
        }))
      : [],
    sentiment: clamp(Math.round(Number(s.sentiment) || 50), 0, 100),
  };
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
