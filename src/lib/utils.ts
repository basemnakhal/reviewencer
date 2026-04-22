import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Tailwind-aware class-name join — the standard shadcn cn() helper. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format 4.3 → "4.3", 4.0 → "4.0", null → "—". */
export function formatRating(v: number | null | undefined): string {
  if (v == null) return '—';
  return v.toFixed(1);
}

/** Format 612 → "612", 1200 → "1.2k". */
export function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return Math.round(n / 1000) + 'k';
}

/** "2 hours ago"-style relative time. */
export function relativeTime(iso: string): string {
  const d = new Date(iso).getTime();
  const diff = Math.floor((Date.now() - d) / 1000);
  if (diff < 60)     return 'just now';
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-AE', { month: 'short', day: 'numeric' });
}

/** Safe JSON parse — returns null on failure. */
export function tryParseJson<T = unknown>(s: string): T | null {
  try { return JSON.parse(s) as T; } catch { return null; }
}

/**
 * Extract JSON from a Claude response that may wrap it in ```json fences
 * or prose. Returns null if no valid JSON is found.
 */
export function extractJson<T = unknown>(text: string): T | null {
  // 1) Fenced ```json ... ```
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) {
    const parsed = tryParseJson<T>(fence[1].trim());
    if (parsed) return parsed;
  }
  // 2) First balanced { ... } or [ ... ]
  const first = text.search(/[{[]/);
  if (first >= 0) {
    for (let end = text.length; end > first; end--) {
      const candidate = text.slice(first, end);
      const parsed = tryParseJson<T>(candidate);
      if (parsed) return parsed;
    }
  }
  return null;
}

/** UAE phone number — E.164 normaliser. Accepts 050..., +9715..., 009715... */
export function normalizeUaePhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  if (!digits) return null;
  let core = digits;
  if (core.startsWith('00971')) core = core.slice(5);
  else if (core.startsWith('971')) core = core.slice(3);
  else if (core.startsWith('0'))   core = core.slice(1);
  // Mobile prefixes in the UAE: 50, 52, 54, 55, 56, 58
  if (!/^(50|52|54|55|56|58)\d{7}$/.test(core)) return null;
  return '+971' + core;
}

/** Truncate preserving word boundary. */
export function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  const slice = s.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  return (lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice) + '…';
}

/** Deterministic color from string — used for category tints when no brand_color. */
export function hashTint(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const palette = ['#0A47A5', '#2563EB', '#D4A72C', '#E5B44A', '#0B1F47'];
  return palette[Math.abs(h) % palette.length];
}
