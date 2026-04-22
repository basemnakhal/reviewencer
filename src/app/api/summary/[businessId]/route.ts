/**
 * POST /api/summary/[businessId]
 *   Force-rebuild an AI summary for one business. Moderator/admin only.
 *
 * GET  /api/summary/[businessId]
 *   Read the current AI summary. Open endpoint.
 *
 * For bulk stale rebuilds, the npm script `summaries:rebuild` calls
 * rebuildStaleSummaries() directly (not through this route).
 */
import { NextResponse } from 'next/server';
import { rebuildSummary } from '@/lib/summaries';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { err, json, requireRole } from '@/lib/api';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface Params { params: { businessId: string } }

export async function GET(_req: Request, { params }: Params) {
  const supa = createSupabaseServiceClient();
  const { data, error } = await supa
    .from('ai_summaries').select('*').eq('business_id', params.businessId).single();
  if (error || !data) return err('No summary yet.', 404);
  return json(data);
}

export async function POST(_req: Request, { params }: Params) {
  const who = await requireRole(['moderator', 'admin']);
  if (who instanceof NextResponse) return who;

  try {
    const summary = await rebuildSummary(params.businessId);
    return json(summary);
  } catch (e) {
    console.error('[summary] rebuild failed', e);
    return err('Rebuild failed.', 500);
  }
}
