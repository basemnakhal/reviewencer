/**
 * POST /api/auth/otp/start
 *
 * Body: { phone: string; channel?: 'whatsapp' | 'sms' }
 *
 * Starts a phone OTP challenge. UAE numbers only (+971 5x...). Rate-limited
 * to 3 attempts per hour per number.
 */
import { startOtp } from '@/lib/otp';
import { err, json, readJson } from '@/lib/api';

export const runtime = 'nodejs';

interface Body { phone?: string; channel?: 'whatsapp' | 'sms' }

export async function POST(req: Request) {
  const body = await readJson<Body>(req);
  if (!body?.phone) return err('Missing "phone".');

  const preferWhatsApp = body.channel !== 'sms';
  const result = await startOtp(body.phone, preferWhatsApp);
  if (!result.ok) return err(result.error ?? 'Could not start OTP.', result.retryAfter ? 429 : 400,
    result.retryAfter ? { retryAfter: result.retryAfter } : undefined);

  return json({ ok: true, phone: result.phone, channel: result.channel });
}
