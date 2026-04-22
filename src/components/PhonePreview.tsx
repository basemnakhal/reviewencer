'use client';

import { useEffect, useRef, useState } from 'react';
import { VideoReviewCard, type VideoReviewCardData } from '@/components/VideoReviewCard';
import { cn } from '@/lib/utils';

interface Props {
  reviews: VideoReviewCardData[];
  className?: string;
}

/**
 * Swipeable phone-frame right rail. Vertical scroll-snap through video
 * reviews with TikTok-style auto-play on the visible slide.
 */
export function PhonePreview({ reviews, className }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const root = scrollerRef.current;
    if (!root || reviews.length === 0) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio > 0.6) {
            const idx = Number((e.target as HTMLElement).dataset.idx);
            if (!Number.isNaN(idx)) setActiveIdx(idx);
          }
        }
      },
      { root, threshold: [0.6, 0.9] },
    );

    const slides = root.querySelectorAll<HTMLElement>('[data-idx]');
    slides.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [reviews.length]);

  if (reviews.length === 0) {
    return (
      <div className={cn('phone-frame flex h-[640px] w-[320px] items-center justify-center', className)}>
        <div className="text-center text-sm text-white/70 px-6">
          Be the first to drop a video review 🎬
        </div>
      </div>
    );
  }

  return (
    <div className={cn('phone-frame relative h-[640px] w-[320px] overflow-hidden', className)}>
      <div ref={scrollerRef} className="phone-surface h-full w-full">
        {reviews.map((r, i) => (
          <div
            key={r.id}
            data-idx={i}
            className="relative h-full w-full snap-start snap-always"
          >
            <VideoReviewCard review={r} active={i === activeIdx} className="h-full w-full rounded-none" />
          </div>
        ))}
      </div>

      {/* Progress pips */}
      <div className="pointer-events-none absolute right-1.5 top-1/2 flex -translate-y-1/2 flex-col gap-1">
        {reviews.map((_, i) => (
          <span
            key={i}
            className={cn(
              'h-5 w-0.5 rounded-full transition-all',
              i === activeIdx ? 'bg-white' : 'bg-white/30',
            )}
          />
        ))}
      </div>
    </div>
  );
}
