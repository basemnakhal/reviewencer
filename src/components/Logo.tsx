/**
 * Logo — the approved Play-mark R.
 * Royal-blue squircle, gold R, gold play triangle in the bottom-right corner.
 * Optionally renders the wordmark alongside.
 */
import { cn } from '@/lib/utils';

interface LogoProps {
  size?:     number;          // px — the squircle dimension
  wordmark?: boolean;         // show "reviewencer" to the right of the mark
  tone?:     'light' | 'dark'; // dark = navy mark on cream surfaces
  className?: string;
}

export function Logo({ size = 40, wordmark = true, tone = 'light', className }: LogoProps) {
  const bg   = tone === 'dark' ? '#0B1F47' : '#0A47A5';
  const gold = '#D4A72C';

  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
        <rect width="48" height="48" rx="13" fill={bg} />
        <text
          x="24" y="34" textAnchor="middle"
          fill={gold}
          fontSize="32" fontWeight="900"
          fontFamily="var(--font-inter), system-ui, sans-serif"
        >
          R
        </text>
        <polygon points="34,34 44,38 34,42" fill={gold} />
      </svg>
      {wordmark && (
        <span className="font-sans text-[18px] font-black tracking-tight text-royal-900">
          reviewencer
        </span>
      )}
    </div>
  );
}
