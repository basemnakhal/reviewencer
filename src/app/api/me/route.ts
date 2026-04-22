/**
 * GET  /api/me  — current user + profile row; 200 with null if not signed in.
 * POST /api/me  — update display_name / handle / avatar_url for the caller.
 */
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { err, json, readJson, requireUser } from '@/lib/api';

export const runtime = 'nodejs';

export async function GET() {
  const supa = createSupabaseServerClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return json({ user: null, profile: null });

  const { data: profile } = await supa
    .from('profiles')
    .select('id, handle, display_name, avatar_url, role, created_at')
    .eq('id', user.id)
    .single();
  return json({ user: { id: user.id, phone: user.phone ?? null }, profile });
}

interface PatchBody {
  handle?:       string;
  display_name?: string;
  avatar_url?:   string;
}

export async function POST(req: Request) {
  const who = await requireUser();
  if (who instanceof NextResponse) return who;

  const body = await readJson<PatchBody>(req);
  if (!body) return err('Empty body.');

  const patch: PatchBody = {};
  if (body.handle)       patch.handle       = String(body.handle).slice(0, 40);
  if (body.display_name) patch.display_name = String(body.display_name).slice(0, 80);
  if (body.avatar_url)   patch.avatar_url   = String(body.avatar_url).slice(0, 500);

  const supa = createSupabaseServerClient();
  const { error } = await supa.from('profiles').update(patch).eq('id', who.user.id);
  if (error) return err(error.message, 400);
  return json({ ok: true });
}
