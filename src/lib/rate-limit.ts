/**
 * Simple in-memory rate limiter — good enough for single-instance dev and
 * low-traffic production. When you deploy to multi-instance, swap this for
 * Supabase (a `rate_limits` table) or Upstash Redis.
 *
 * Usage:
 *   const { ok, retryAfter } = rateLimit(`otp:${phone}`, 3, 60 * 60_000);
 *   if (!ok) return error(429, `Try again in ${retryAfter}s`);
 */

interface Bucket {
  hits:      number[];      // timestamps (ms)
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok:         boolean;
  remaining:  number;
  retryAfter: number; // seconds
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { hits: [] };
  // prune expired
  bucket.hits = bucket.hits.filter(t => now - t < windowMs);

  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0];
    const retryAfter = Math.ceil((windowMs - (now - oldest)) / 1000);
    buckets.set(key, bucket);
    return { ok: false, remaining: 0, retryAfter };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);
  return { ok: true, remaining: limit - bucket.hits.length, retryAfter: 0 };
}

/** Preset: OTP — 3 attempts per hour per phone number. */
export const otpRateLimit = (phone: string) =>
  rateLimit(`otp:${phone}`, 3, 60 * 60 * 1000);

/** Preset: chat — 30 asks per minute per session. */
export const chatRateLimit = (sessionId: string) =>
  rateLimit(`chat:${sessionId}`, 30, 60 * 1000);

/** Preset: review submit — 5 per day per user. */
export const reviewRateLimit = (userId: string) =>
  rateLimit(`review:${userId}`, 5, 24 * 60 * 60 * 1000);
