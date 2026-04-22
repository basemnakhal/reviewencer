/**
 * Retrieval-Augmented Generation for the Ask chatbot.
 *
 * Flow:
 *   1. Embed the user question → vector
 *   2. Call match_reviews() on Supabase → top-N similar published reviews
 *   3. Group by business and attach each business's AI summary + meta
 *   4. Send everything to Claude with a system prompt that forces a
 *      comparison-card JSON answer (see ChatAnswer in types.ts)
 */
import 'server-only';
import { askClaudeJson } from '@/lib/claude';
import { embedQuery } from '@/lib/embeddings';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import type { ChatAnswer, MatchedReview } from '@/lib/types';

const SYSTEM_PROMPT = `You are Reviewencer's AI assistant. You answer questions about UAE businesses
using ONLY the real customer reviews provided to you as context.

RULES
  • Never invent businesses, quotes, ratings, or facts. If the context does not
    support a claim, do not make it.
  • Answer in the user's language (English or Arabic). Default to English.
  • The user sees your answer as a comparison page: a short prose summary at the
    top, a ranked list of up to 3 businesses, and follow-up suggestion chips.
  • Only recommend businesses that appear in the provided context.
  • Pull quotes must be verbatim from the cited reviews.

OUTPUT — respond with a single JSON object, nothing else:

{
  "prose":      "2–3 sentence intro — who wins, why, and any caveat",
  "comparison": [
    {
      "rank":             1,
      "business_id":      "<uuid from context>",
      "business_slug":    "<slug from context>",
      "business_name":    "<name from context>",
      "headline":         "one-line takeaway, max 80 chars",
      "summary":          "2 sentences, grounded in the cited reviews",
      "rating":           4.6,
      "review_count":     312,
      "pull_quote":       "verbatim quote from a cited review",
      "cited_review_ids": ["<uuid>", "<uuid>"]
    }
  ],
  "follow_ups": ["3 short follow-up questions the user might want to ask next"],
  "cited_review_ids": ["every review uuid referenced anywhere above"]
}

If the context contains no relevant reviews for the user's question, return:
  { "prose": "I don't have reviews on that yet. Try a broader question or record your own review.",
    "comparison": [], "follow_ups": [...], "cited_review_ids": [] }`;

export interface AnswerOptions {
  query: string;
  filterCategory?: string | null;
  matchCount?: number;
}

export async function answerQuestion(opts: AnswerOptions): Promise<ChatAnswer> {
  const supa = createSupabaseServiceClient();
  const queryEmbedding = await embedQuery(opts.query);

  // 1) Semantic retrieve
  const { data: matches, error } = await supa.rpc('match_reviews', {
    query_embedding: queryEmbedding,
    match_count:     opts.matchCount     ?? 16,
    filter_category: opts.filterCategory ?? null,
  });
  if (error) throw error;

  const rows = (matches ?? []) as MatchedReview[];
  if (rows.length === 0) {
    return emptyAnswer(
      `I don't have reviews on that yet. Try a broader question or record your own review.`,
    );
  }

  // 2) Group by business for the prompt
  const byBusiness = groupBy(rows, r => r.business_id);
  const businessIds = Object.keys(byBusiness);

  const { data: bizMeta } = await supa
    .from('business_cards')
    .select('*')
    .in('id', businessIds);

  const metaById = new Map((bizMeta ?? []).map(b => [b.id, b]));

  // 3) Build the context block — compact & easy for Claude to cite
  const contextBlock = businessIds.map(id => {
    const meta = metaById.get(id);
    const revs = byBusiness[id].slice(0, 4);
    return [
      `=== Business ===`,
      `id:          ${id}`,
      `slug:        ${meta?.slug ?? ''}`,
      `name:        ${meta?.name ?? revs[0]?.business_name ?? ''}`,
      `category:    ${meta?.category_id ?? ''}`,
      `ai_headline: ${meta?.ai_headline ?? ''}`,
      `rating:      ${meta?.avg_rating ?? 0}`,
      `reviews:     ${meta?.review_count ?? 0}`,
      `Sample reviews (most similar to the user's question first):`,
      ...revs.map((r, i) =>
        `  [${i + 1}] review_id=${r.id} rating=${r.rating}/5 similarity=${r.similarity.toFixed(3)}\n      "${r.text.replace(/\s+/g, ' ').trim()}"`,
      ),
    ].join('\n');
  }).join('\n\n');

  const user = [
    `User question: ${opts.query}`,
    opts.filterCategory ? `Category filter: ${opts.filterCategory}` : '',
    '',
    'Context (only use these businesses and reviews):',
    contextBlock,
  ].filter(Boolean).join('\n');

  // 4) Ask Claude
  const answer = await askClaudeJson<ChatAnswer>({
    system: SYSTEM_PROMPT,
    user,
    maxTokens: 1800,
    temperature: 0.25,
  });

  return sanitizeAnswer(answer);
}

// ---------- internals ----------

function emptyAnswer(prose: string): ChatAnswer {
  return {
    prose,
    comparison: [],
    follow_ups: [
      'Best bank in UAE for car mortgage?',
      'Fastest food delivery in Dubai?',
      'Best 5G telecom plan in the UAE?',
    ],
    cited_review_ids: [],
  };
}

function groupBy<T, K extends string | number>(xs: T[], key: (t: T) => K): Record<K, T[]> {
  const out = {} as Record<K, T[]>;
  for (const x of xs) {
    const k = key(x);
    (out[k] ??= []).push(x);
  }
  return out;
}

function sanitizeAnswer(a: ChatAnswer): ChatAnswer {
  return {
    prose: String(a.prose ?? '').slice(0, 600),
    comparison: Array.isArray(a.comparison)
      ? a.comparison.slice(0, 5).map((c, i) => ({
          rank:             Number(c.rank) || i + 1,
          business_id:      String(c.business_id ?? ''),
          business_slug:    String(c.business_slug ?? ''),
          business_name:    String(c.business_name ?? ''),
          headline:         String(c.headline ?? '').slice(0, 120),
          summary:          String(c.summary ?? '').slice(0, 400),
          rating:           Number(c.rating)       || 0,
          review_count:     Number(c.review_count) || 0,
          pull_quote:       c.pull_quote ? String(c.pull_quote).slice(0, 240) : null,
          cited_review_ids: Array.isArray(c.cited_review_ids)
            ? c.cited_review_ids.map(String).slice(0, 6)
            : [],
        }))
      : [],
    follow_ups: Array.isArray(a.follow_ups)
      ? a.follow_ups.slice(0, 4).map(s => String(s).slice(0, 80))
      : [],
    cited_review_ids: Array.isArray(a.cited_review_ids)
      ? a.cited_review_ids.map(String).slice(0, 20)
      : [],
  };
}
