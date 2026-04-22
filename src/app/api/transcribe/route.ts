/**
 * POST /api/transcribe
 *
 * Body: { videoKey: string }
 *
 * Downloads the uploaded video from Supabase Storage and runs Whisper on it.
 * Returns the transcript text. The client can then pre-fill the review text
 * area before the user submits to /api/review.
 *
 * Size cap: 25 MB (Whisper API limit).
 */
import { NextResponse } from 'next/server';
import { downloadVideo } from '@/lib/storage';
import { transcribe } from '@/lib/openai';
import { err, json, readJson, requireUser } from '@/lib/api';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface Body { videoKey?: string }

const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(req: Request) {
  const who = await requireUser();
  if (who instanceof NextResponse) return who;

  const body = await readJson<Body>(req);
  if (!body?.videoKey) return err('Missing "videoKey".');

  // Authorise — key must belong to the caller
  if (!body.videoKey.startsWith(`${who.user.id}/`)) return err('Forbidden.', 403);

  try {
    const blob = await downloadVideo(body.videoKey);
    if (blob.size > MAX_BYTES) return err('Video too large (max 25 MB).', 413);

    // Convert Blob → File — Whisper SDK wants a file-like with a name
    const file = new File([blob], body.videoKey.split('/').pop() ?? 'review.mp4', {
      type: blob.type || 'video/mp4',
    });
    const text = await transcribe(file);
    return json({ text });
  } catch (e) {
    console.error('[transcribe] failed', e);
    return err('Transcription failed.', 500);
  }
}
