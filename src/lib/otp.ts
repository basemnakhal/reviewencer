/**
 * UAE phone-number OTP helpers.
 *
 * Phase 1 (this file): Supabase's built-in phone auth (Twilio Verify).
 * Phase 2 (later):     swap provider to Unifonic for WhatsApp-primary delivery
 *                      with SMS fallback.
 *
 * The critical UAE constraints are enforced before we hand off to the provider:
 *   - only +971 5x mobile numbers (enforced in utils.normalizeUaePhone)
 *   - 3 requests / hour / number (enforced in rate-limit.otpRateLimit)
 *
 * Both API routes (/api/auth/otp/start and /api/auth/otp/verify) call the
 * helpers below.
 */
import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { normalizeUaePhone } from '@/lib/utils';
import { otpRateLimit } from '@/lib/rate-limit';

export interface OtpStartResult {
  ok:         boolean;
  phone?:     string;
  channel?:   'sms' | 'whatsapp';
  error?:     string;
  retryAfter?: number;
}

export async function startOtp(rawPhone: string, preferWhatsApp = true): Promise<OtpStartResult> {
  const phone = normalizeUaePhone(rawPhone);
  if (!phone) return { ok: false, error: 'Please enter a valid UAE mobile number (05x xxx xxxx).' };

  const limit = otpRateLimit(phone);
  if (!limit.ok) {
    return { ok: false, error: `Too many attempts. Try again in ${limit.retryAfter}s.`, retryAfter: limit.retryAfter };
  }

  const supa = createSupabaseServerClient();
  const { error } = await supa.auth.signInWithOtp({
    phone,
    options: { channel: preferWhatsApp ? 'whatsapp' : 'sms' },
  });
  if (error) return { ok: false, error: error.message };

  return { ok: true, phone, channel: preferWhatsApp ? 'whatsapp' : 'sms' };
}

export async function verifyOtp(rawPhone: string, code: string) {
  const phone = normalizeUaePhone(rawPhone);
  if (!phone) return { ok: false as const, error: 'Invalid UAE phone number.' };
  const digits = code.replace(/\D/g, '');
  if (digits.length < 4) return { ok: false as const, error: 'Invalid code.' };

  const supa = createSupabaseServerClient();
  const { data, error } = await supa.auth.verifyOtp({ phone, token: digits, type: 'sms' });
  if (error || !data.session) return { ok: false as const, error: error?.message ?? 'Verification failed.' };
  return { ok: true as const, userId: data.user?.id ?? null };
}
