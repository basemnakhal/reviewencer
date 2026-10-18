'use client';

import { useEffect, useRef, useState } from 'react';
import { Play, Volume2, VolumeX, Heart, MessageCircle, Share2, ShieldCheck } from 'lucide-react';
import { StarRating } from '@/components/ui/StarRating';
import { cn, formatCount } from '@/lib/utils';
import { BusinessLogo } from '@/components/BusinessLogo';

export interface VideoReviewCardData {
  id:            string;
  video_url:     string | null;
  poster_url?:   string | null;
  rating:        number;
  text:          string;
  author: {
    display_name: string | null;
    handle:       string | null;
    avatar_url:   string | null;
  } | null;
  business: {
    name:  string;
    slug:  string;
    logo?: string | null;
    verified?: boolean;
  };
  likes?:     number;
  comments?:  number;
}

interface Props {
  review: VideoReviewCardData;
  active?: boolean;
  onLike?: () => void;
  onOpen?: () => void;
  className?: string;
}

export function VideoReviewCard({ review, active, onLike, onOpen, className }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (active) {
      v.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    } else {
      v.pause();
      setPlaying(false);
    }
  }, [active]);

  const initial = (review.author?.display_name ?? review.author?.handle ?? 'U')[0]?.toUpperCase() ?? 'U';

  return (
    <div className={cn('relative h-full w-full overflow-hidden rounded-[28px] bg-black', className)}>
      {review.video_url ? (
        <video
          ref={videoRef}
          src={review.video_url}
          poster={review.poster_url ?? undefined}
          loop
          muted={muted}
          playsInline
          className="h-full w-full object-cover"
          onClick={() => {
            const v = videoRef.current;
            if (!v) return;
            if (v.paused) { v.play(); setPlaying(true); } else { v.pause(); setPlaying(false); }
          }}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-royal-gradient text-white">
          <div className="text-center px-6">
            <div className="mx-auto mb-2 h-10 w-10 overflow-hidden rounded-lg text-4xl"><BusinessLogo logo={review.business.logo} fallback="💬" /></div>
            <p className="text-sm font-semibold leading-relaxed">{review.text}</p>
          </div>
        </div>
      )}

      {/* Play overlay */}
      {review.video_url && !playing && (
        <button
          onClick={() => { videoRef.current?.play(); setPlaying(true); }}
          className="absolute inset-0 flex items-center justify-center bg-black/20"
          aria-label="Play video"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-royal-900 shadow-xl">
            <Play size={28} fill="currentColor" className="ml-1" />
          </div>
        </button>
      )}

      {/* Top gradient for business badge */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/60 to-transparent" />

      {/* Business badge */}
      <button
        onClick={onOpen}
        className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-white/95 px-2.5 py-1.5 text-xs font-black text-royal-900 shadow backdrop-blur"
      >
        <span className="inline-flex h-4 w-4 items-center justify-center overflow-hidden rounded text-sm"><BusinessLogo logo={review.business.logo} /></span>
        <span className="max-w-[120px] truncate">{review.business.name}</span>
        {review.business.verified && <ShieldCheck size={12} className="text-royal-600" />}
      </button>

      {/* Mute toggle */}
      {review.video_url && (
        <button
          onClick={() => setMuted((m) => !m)}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur"
          aria-label={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>
      )}

      {/* Bottom gradient */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

      {/* Author + caption */}
      <div className="absolute inset-x-3 bottom-3 text-white">
        <div className="mb-1.5 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-royal-gradient text-[11px] font-black">
            {initial}
          </div>
          <div className="text-xs font-bold">
            {review.author?.display_name ?? review.author?.handle ?? 'Anonymous'}
          </div>
          <StarRating value={review.rating} size={11} label={false} />
        </div>
        <p className="line-clamp-3 text-sm leading-snug drop-shadow">{review.text}</p>
      </div>

      {/* Right-side action rail */}
      <div className="absolute bottom-20 right-3 flex flex-col items-center gap-3 text-white">
        <button onClick={onLike} className="flex flex-col items-center">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 backdrop-blur">
            <Heart size={16} />
          </div>
          <span className="mt-1 text-[10px] font-bold">{formatCount(review.likes ?? 0)}</span>
        </button>
        <button onClick={onOpen} className="flex flex-col items-center">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 backdrop-blur">
            <MessageCircle size={16} />
          </div>
          <span className="mt-1 text-[10px] font-bold">{formatCount(review.comments ?? 0)}</span>
        </button>
        <button className="flex flex-col items-center">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 backdrop-blur">
            <Share2 size={16} />
          </div>
          <span className="mt-1 text-[10px] font-bold">Share</span>
        </button>
      </div>
    </div>
  );
}
