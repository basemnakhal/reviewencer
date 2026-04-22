/**
 * Supabase browser client — use in Client Components and event handlers.
 * Uses the public anon key + session from cookies.
 */
import { createBrowserClient } from '@supabase/ssr';
import { env } from '@/lib/env';

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
