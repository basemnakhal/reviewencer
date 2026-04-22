/**
 * POST /api/moderation/decide
 *
 * Body: {
 *   reviewId: string
 *   decision: 'publish' | 'reject'
 *   note?:    string       // moderator-only note, stored in rationale
 * }
 *
 * Transitions a flagged review to published or rejected and writes an audit
 * row. If published, kicks off the embedding job.
 */
import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { embedAndStoreReview } from '@/lib/embeddings';
import { err, json, readJson, requireRole } from '@/lib/api';
import type { ModerationStatus } from '@/lib/types';

export const runtime = 'nodejs';

interface Body {
  reviewId?: string;
  decision?: 'publish' | 'reject';
  note?:     string;
}

export async function POST(req: Request) {
  const who = await requireRole(['moderator', 'admin']);
  if (who instanceof NextResponse) return who;

  const body = await readJson<Body>(req);
  if (!body?.reviewId) return err('Missing "reviewId".');
  if (body.decision !== 'publish' && body.decision !== 'reject') return err('Invalid "decision".');

  const newStatus: ModerationStatus = body.decision === 'publish' ? 'published' : 'rejected';

  const svc = createSupabaseServiceClient();
  // Fetch current status for the audit row
  const { data: current, error: fetchErr } = await svc
    .from('reviews').select('moderation_status').eq('id', body.reviewId).single();
  if (fetchErr || !current) return err('Review not found.', 404);

  const { error: updErr } = await svc
    .from('reviews')
    .update({
      moderation_status:    newStatus,
      moderation_rationale: body.note ?? null,
      published_at:         newStatus === 'published' ? new Date().toISOString() : null,
    })
    .eq('id', body.reviewId);
  if (updErr) return err(updErr.message, 500);

  const { error: evtErr } = await svc.from('moderation_events').insert({
    review_id:       body.reviewId,
    actor_id:        who.user.id,
    actor_type:      who.role === 'admin' ? 'admin' : 'moderator',
    from_status:     current.moderation_status,
    to_status:       newStatus,
    rationale:       body.note ?? null,
    risk_categories: [],
    model:           null,
  });
  if (evtErr) console.error('[moderation] audit failed', evtErr);

  if (newStatus === 'published') {
    void embedAndStoreReview(body.reviewId).catch(e => console.error('[embed] failed', e));
  }

  return json({ ok: true, status: newStatus });
}
