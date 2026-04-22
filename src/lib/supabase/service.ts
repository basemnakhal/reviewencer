/**
 * Supabase service-role client — bypasses RLS. Use for:
 *   - Moderation pipeline (writing moderation_status on behalf of AI)
 *   - AI summary rebuilds
 *   - Embedding backfills
 *   - Admin dashboards
 *
 * NEVER import this into a Client Component — it carries the service role key.
 */
import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

let cached: SupabaseClient | null = null;

export function createSupabaseServiceClient(): SupabaseClient {
  if (cached) return cached;
  cached = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    db:   { schema: 'public' },
  });
  return cached;
}
