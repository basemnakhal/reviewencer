/**
 * Embedding helpers — build the text we embed, call OpenAI, and
 * (optionally) persist the vector back to Supabase.
 */
import 'server-only';
import { embedText } from '@/lib/openai';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import type { Review } from '@/lib/types';

/**
 * Compose the string we embed for a review. Includes rating and tags so
 * "which banks are fastest?" also matches reviews with tags=['speed'].
 */
export function reviewEmbeddingText(r: Pick<Review, 'text' | 'rating' | 'tags'>): string {
  const tags = (r.tags ?? []).join(', ');
  return [
    `Rating: ${r.rating}/5`,
    tags ? `Tags: ${tags}` : '',
    r.text,
  ].filter(Boolean).join('\n');
}

/** Embed a single review and write the vector back. */
export async function embedAndStoreReview(reviewId: string): Promise<void> {
  const supa = createSupabaseServiceClient();
  const { data: row, error } = await supa
    .from('reviews')
    .select('id, text, rating, tags')
    .eq('id', reviewId)
    .single();
  if (error || !row) throw error ?? new Error(`review ${reviewId} not found`);

  const vec = await embedText(reviewEmbeddingText(row as Pick<Review, 'text' | 'rating' | 'tags'>));
  const { error: upErr } = await supa
    .from('reviews')
    .update({ embedding: vec })
    .eq('id', reviewId);
  if (upErr) throw upErr;
}

/** Embed the user's query for semantic search. No storage. */
export function embedQuery(q: string) {
  return embedText(q);
}
