/**
 * GET /api/moderation/queue?status=flagged&limit=50
 *
 * Returns reviews awaiting moderator decision. Moderator/admin only.
 * Joins the business and author for display. Ordered oldest-first so
 * the queue is FIFO.
 */
import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { err, json, requireRole } from '@/lib/api';
import type { ModerationStatus } from '@/lib/types';

export const runtime = 'nodejs';

const DEFAULT_STATUS: ModerationStatus = 'flagged';

export async function GET(req: Request) {
  const who = await requireRole(['moderator', 'admin']);
  if (who instanceof NextResponse) return who;

  const url = new URL(req.url);
  const status = (url.searchParams.get('status') ?? DEFAULT_STATUS) as ModerationStatus;
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 200);

  const supa = createSupabaseServiceClient();
  const { data, error } = await supa
    .from('reviews')
    .select(`
      id, rating, text, tags, moderation_status, moderation_rationale,
      risk_categories, video_url, transcript_source, created_at,
      business:businesses(id, slug, name, category_id),
      author:profiles(id, handle, display_name)
    `)
    .eq('moderation_status', status)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('[mod queue]', error);
    return err(error.message, 500);
  }
  return json({ items: data ?? [], status, count: data?.length ?? 0 });
}
