/**
 * POST /api/auth/otp/verify
 *
 * Body: { phone: string; code: string }
 *
 * Verifies the OTP and, if successful, ensures the caller has a row in
 * `profiles` (new users are created with role='user'). The Supabase server
 * client automatically writes the session cookies.
 */
import { verifyOtp } from '@/lib/otp';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { err, json, readJson } from '@/lib/api';

export const runtime = 'nodejs';

interface Body { phone?: string; code?: string }

export async function POST(req: Request) {
  const body = await readJson<Body>(req);
  if (!body?.phone || !body.code) return err('Missing "phone" or "code".');

  const result = await verifyOtp(body.phone, body.code);
  if (!result.ok) return err(result.error, 401);

  if (result.userId) {
    // Ensure a profile row exists. RLS allows the user to insert/update
    // their own row, but service-role is simpler + more reliable here.
    const svc = createSupabaseServiceClient();
    await svc.from('profiles').upsert(
      { id: result.userId, role: 'user' },
      { onConflict: 'id', ignoreDuplicates: false },
    );
  }

  return json({ ok: true, userId: result.userId });
}
