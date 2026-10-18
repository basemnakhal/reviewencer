/**
 * POST /api/review
 *
 * Submit a new review. Requires an authenticated user (phone OTP).
 *
 * Body: {
 *   businessId:       string (uuid)
 *   rating:           1..5
 *   text:             string (1–2000 chars)
 *   tags?:            string[]
 *   videoKey?:        string            // storage key if the user uploaded a video
 *   transcriptSource?: 'typed' | 'video_transcription'
 * }
 *
 * Flow:
 *   1. Validate input + rate-limit
 *   2. Insert review row with moderation_status='pending'
 *   3. Call moderation.moderateAndRecord → sets status to published/flagged/rejected
 *   4. If published, kick off embedding (fire-and-forget)
 *   5. Return the verdict so the UI can show the right post-submit screen
 */
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { moderateAndRecord } from '@/lib/moderation';
import { embedAndStoreReview } from '@/lib/embeddings';
import { reviewRateLimit } from '@/lib/rate-limit';
import { err, json, readJson, requireUser } from '@/lib/api';
import { NextResponse } from 'next/server';
import type { TranscriptSource } from '@/lib/types';

export const runtime = 'nodejs';

interface Body {
  businessId?:        string;
  rating?:            number;
  text?:              string;
  tags?:              string[];
  videoKey?:          string | null;
  transcriptSource?:  TranscriptSource;
}

export async function POST(req: Request) {
  const who = await requireUser();
  if (who instanceof NextResponse) return who;
  const { user } = who;

  const limit = reviewRateLimit(user.id);
  if (!limit.ok) return err('Too many submissions today. Try tomorrow.', 429, { retryAfter: limit.retryAfter });

  const body = await readJson<Body>(req);
  if (!body?.businessId) return err('Missing "businessId".');
  if (typeof body.rating !== 'number' || body.rating < 1 || body.rating > 5) return err('Rating must be 1–5.');
  if (!body.text || typeof body.text !== 'string') return err('Missing "text".');
  const text = body.text.trim();
  if (text.length < 20)   return err('Tell us a bit more — at least 20 characters.');
  if (text.length > 2000) return err('That\'s a lot — please keep it under 2000 characters.');

  const tags = Array.isArray(body.tags) ? body.tags.map(String).slice(0, 6) : [];
  const transcriptSource: TranscriptSource =
    body.transcriptSource === 'video_transcription' ? 'video_transcription' : 'typed';

  const supa = createSupabaseServerClient();  // RLS-scoped insert as the user
  const { data: inserted, error: insErr } = await supa
    .from('reviews')
    .insert({
      business_id:       body.businessId,
      author_id:         user.id,
      rating:            body.rating,
      text,
      tags,
      video_url:         body.videoKey ?? null,
      transcript_source: transcriptSource,
      moderation_status: 'pending',
    })
    .select('id')
    .single();

  if (insErr || !inserted) {
    console.error('[review] insert failed', insErr);
    return err(insErr?.message ?? 'Could not save review.', 400);
  }

  // Business name for moderator context
  const svc = createSupabaseServiceClient();
  const { data: biz } = await svc.from('businesses').select('name:name_en').eq('id', body.businessId).single();

  // Run legal moderation synchronously — the user deserves an immediate verdict
  const verdict = await moderateAndRecord(inserted.id, biz?.name ?? 'Unknown', text, body.rating);

  // If published, start embedding in the background
  if (verdict.status === 'auto_approved') {
    void embedAndStoreReview(inserted.id).catch(e => console.error('[embed] failed', e));
  }

  return json({
    reviewId: inserted.id,
    verdict,
  });
}
