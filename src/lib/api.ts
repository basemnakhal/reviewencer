/**
 * Shared helpers for API route handlers.
 *  - json()          : tiny NextResponse.json wrapper with typed body
 *  - err()           : error response shorthand
 *  - readJson()      : safe JSON body parsing
 *  - requireUser()   : return the authenticated user or 401
 *  - requireRole()   : ensure user has mod/admin role or 403
 */
import 'server-only';
import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import type { UserRole } from '@/lib/types';

export function json<T>(body: T, init?: ResponseInit) {
  return NextResponse.json(body, init);
}

export function err(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export async function readJson<T = unknown>(req: Request): Promise<T | null> {
  try { return (await req.json()) as T; } catch { return null; }
}

export async function requireUser(): Promise<{ user: User } | NextResponse> {
  const supa = createSupabaseServerClient();
  const { data, error } = await supa.auth.getUser();
  if (error || !data.user) return err('Not signed in.', 401);
  return { user: data.user };
}

export async function requireRole(roles: UserRole[]): Promise<
  | { user: User; role: UserRole }
  | NextResponse
> {
  const r = await requireUser();
  if (r instanceof NextResponse) return r;
  const { user } = r;

  const svc = createSupabaseServiceClient();
  const { data: profile, error } = await svc
    .from('profiles').select('role').eq('id', user.id).single();
  if (error || !profile) return err('Profile not found.', 403);

  const role = profile.role as UserRole;
  if (!roles.includes(role)) return err('Forbidden.', 403);
  return { user, role };
}
