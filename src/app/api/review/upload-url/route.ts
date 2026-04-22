/**
 * POST /api/review/upload-url
 *
 * Returns a short-lived signed URL the client can PUT the video blob to.
 * We also return the storage key so the client passes it to /api/transcribe
 * and /api/review afterwards.
 *
 * Body: { ext?: 'mp4' | 'mov' | 'webm' }
 */
import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { createUploadUrl } from '@/lib/storage';
import { err, json, readJson, requireUser } from '@/lib/api';

export const runtime = 'nodejs';

interface Body { ext?: string }

export async function POST(req: Request) {
  const who = await requireUser();
  if (who instanceof NextResponse) return who;

  const body = (await readJson<Body>(req)) ?? {};
  const ext = (body.ext ?? 'mp4').toLowerCase();
  if (!['mp4', 'mov', 'webm', 'm4v'].includes(ext)) return err('Unsupported file type.');

  const reviewId = randomUUID();
  try {
    const signed = await createUploadUrl(who.user.id, reviewId, ext);
    return json({ reviewId, ...signed });
  } catch (e) {
    console.error('[upload-url] failed', e);
    return err('Could not create upload URL.', 500);
  }
}
