// moderate-review: runs the UAE-law moderation check on a freshly submitted
// review and publishes it, flags it for the moderator queue, or rejects it.
// Same rules as the web app's src/lib/moderation.ts.
//
// Body: { reviewId: string } — the caller must be the review's author and the
// review must still be pending.
//
// Secrets: ANTHROPIC_API_KEY
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2.104.0"
import Anthropic from "npm:@anthropic-ai/sdk@0.130.0"

const MODEL = "claude-sonnet-4-6"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
)
const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") })

const SYSTEM_PROMPT = `You are the legal-compliance moderator for Reviewencer, a UAE-based consumer review platform.

Your job: read a review submitted about a business and decide if it is safe to publish
under United Arab Emirates law — in particular:

  • Federal Decree-Law No. 34 of 2021 (Combating Rumours and Cybercrimes)
  • UAE Penal Code, articles on defamation, slander, and insult
  • UAE privacy laws (personal data of named individuals)
  • Religious and political sensitivity rules applicable in the UAE

The review may be in English, Arabic, or a mix of both.

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

Keep rationale friendly and factual. The user will read it.`

const RISKS = [
  "defamation", "insult", "commercial_disparage", "religion_politics",
  "private_info", "hate_speech", "spam_fake", "low_risk",
]

type Verdict = {
  status: "auto_approved" | "flagged" | "rejected"
  risk_categories: string[]
  rationale: string
  suggested_edit: string | null
}

async function moderate(text: string, rating: number, businessName: string): Promise<Verdict> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 800,
    temperature: 0.15,
    system: SYSTEM_PROMPT,
    messages: [{
      role: "user",
      content: [
        `Business being reviewed: ${businessName}`,
        `Rating given: ${rating}/5`,
        "",
        "Review text:",
        "---",
        text,
        "---",
      ].join("\n"),
    }],
  })

  const raw = response.content.find((b) => b.type === "text")?.text ?? "{}"
  const v = JSON.parse(raw.replace(/```json|```/g, "").trim())

  // Clamp to known values; anything unexpected goes to a human.
  const status = v.status === "auto_approved" || v.status === "rejected" ? v.status : "flagged"
  const risks = Array.isArray(v.risk_categories) ? v.risk_categories.filter((r: string) => RISKS.includes(r)) : []
  return {
    status,
    risk_categories: risks.length ? risks : ["low_risk"],
    rationale: String(v.rationale ?? "").slice(0, 500),
    suggested_edit: v.suggested_edit ? String(v.suggested_edit).slice(0, 2000) : null,
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)

  const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? ""
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token)
  const userId = claimsData?.claims?.sub
  if (claimsError || !userId) return json({ error: "Unauthorized" }, 401)

  const { reviewId } = await req.json().catch(() => ({}))
  if (typeof reviewId !== "string") return json({ error: "Expected { reviewId }" }, 400)

  const { data: review, error: fetchError } = await supabase
    .from("reviews")
    .select("id, author_id, rating, text, transcript_en, moderation_status, business:businesses(name_en)")
    .eq("id", reviewId)
    .maybeSingle()
  if (fetchError || !review) return json({ error: "Review not found" }, 404)
  if (review.author_id !== userId) return json({ error: "Forbidden" }, 403)
  if (review.moderation_status !== "pending") {
    return json({ error: `Review is already ${review.moderation_status}` }, 409)
  }

  const content = (review.text || review.transcript_en || "").trim()
  const businessName = (review.business as { name_en?: string } | null)?.name_en ?? "Unknown"

  try {
    // A bare rating has no text to check.
    const verdict: Verdict = content
      ? await moderate(content, review.rating, businessName)
      : { status: "auto_approved", risk_categories: ["low_risk"], rationale: "Rating only — nothing to moderate.", suggested_edit: null }

    const newStatus = verdict.status === "auto_approved" ? "published"
      : verdict.status === "flagged" ? "flagged"
      : "rejected"

    const { error: updateError } = await supabase
      .from("reviews")
      .update({
        moderation_status: newStatus,
        moderation_rationale: verdict.rationale,
        risk_categories: verdict.risk_categories,
        published_at: newStatus === "published" ? new Date().toISOString() : null,
      })
      .eq("id", reviewId)
      .eq("moderation_status", "pending")
    if (updateError) throw updateError

    const { error: eventError } = await supabase.from("moderation_events").insert({
      review_id: reviewId,
      actor_type: content ? "ai" : "system",
      from_status: "pending",
      to_status: newStatus,
      rationale: verdict.rationale,
      risk_categories: verdict.risk_categories,
      model: content ? MODEL : null,
    })
    if (eventError) console.error("moderation_events insert failed:", eventError)

    return json({ status: newStatus, rationale: verdict.rationale, suggested_edit: verdict.suggested_edit })
  } catch (e) {
    // Leave the review pending so it can be retried or picked up by a moderator.
    console.error("moderate-review failed:", e)
    return json({ error: e instanceof Error ? e.message : "Moderation failed" }, 500)
  }
})
