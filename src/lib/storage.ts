/**
 * Video storage helpers — Supabase Storage wrapper for the video review flow.
 *
 * Bucket contract (env.SUPABASE_VIDEO_BUCKET, default "reviews"):
 *   - private bucket
 *   - keys look like  <author_id>/<review_id>.<ext>
 *   - we return signed URLs with a TTL for playback
 *
 * The transcription pipeline downloads the file via a signed URL and feeds
 * it to Whisper; see /api/transcribe.
 */
import 'server-only';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { env } from '@/lib/env';

export function videoBucket() {
  return env.SUPABASE_VIDEO_BUCKET;
}

/** Canonical object key for a review's video. */
export function videoKey(authorId: string, reviewId: string, ext = 'mp4'): string {
  const safeExt = ext.replace(/^\./, '').toLowerCase().slice(0, 5) || 'mp4';
  return `${authorId}/${reviewId}.${safeExt}`;
}

/** Signed upload URL (client uploads directly to Storage). */
export async function createUploadUrl(authorId: string, reviewId: string, ext = 'mp4') {
  const supa = createSupabaseServiceClient();
  const key = videoKey(authorId, reviewId, ext);
  const { data, error } = await supa.storage
    .from(videoBucket())
    .createSignedUploadUrl(key);
  if (error || !data) throw error ?? new Error('failed to sign upload url');
  return { ...data, key };
}

/** Signed playback URL (TTL default 1 hour). */
export async function createPlaybackUrl(key: string, expiresSec = 3600) {
  const supa = createSupabaseServiceClient();
  const { data, error } = await supa.storage
    .from(videoBucket())
    .createSignedUrl(key, expiresSec);
  if (error || !data) throw error ?? new Error('failed to sign playback url');
  return data.signedUrl;
}

/** Server-side download — used by the transcription pipeline. */
export async function downloadVideo(key: string): Promise<Blob> {
  const supa = createSupabaseServiceClient();
  const { data, error } = await supa.storage.from(videoBucket()).download(key);
  if (error || !data) throw error ?? new Error('download failed');
  return data;
}
