/**
 * Logo — the thumbs-up mark.
 * Blue-to-purple gradient rounded-square tile with a white thumbs-up silhouette.
 * Optionally renders the wordmark alongside.
 */
import { cn } from '@/lib/utils';

interface LogoProps {
  size?:     number;          // px — the tile dimension
  wordmark?: boolean;         // show "REVIEWENCER" to the right of the mark
  tone?:     'light' | 'dark'; // dark = for dark surfaces (wordmark flips to white)
  className?: string;
}

export function Logo({ size = 40, wordmark = true, tone = 'light', className }: LogoProps) {
  const wordColor = tone === 'dark' ? '#ffffff' : '#0D1117';
  const gradientId = `brand-grad-${size}-${tone}`;

  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <svg width={size} height={size} viewBox="0 0 500 500" aria-hidden>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#2B8BFF" />
            <stop offset="100%" stopColor="#7B2CFF" />
          </linearGradient>
        </defs>
        <rect width="500" height="500" rx="112" ry="112" fill={`url(#${gradientId})`} />
        <path
          d="M110 60 Q80 60 80 90 L80 410 Q80 440 110 440 L390 440 Q420 440 420 410 L420 270 Q420 240 390 240 L240 240 L240 90 Q240 60 210 60 Z"
          fill="#ffffff"
        />
      </svg>
      {wordmark && (
        <span
          className="font-sans text-[18px] font-black tracking-tight"
          style={{ color: wordColor, letterSpacing: '-0.02em' }}
        >
          REVIEWENCER
        </span>
      )}
    </div>
  );
}
