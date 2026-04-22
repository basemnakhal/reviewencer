/**
 * POST /api/auth/signout — clears the Supabase session cookies.
 */
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { json } from '@/lib/api';

export const runtime = 'nodejs';

export async function POST() {
  const supa = createSupabaseServerClient();
  await supa.auth.signOut();
  return json({ ok: true });
}
