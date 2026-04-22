import { StarRating } from '@/components/ui/StarRating';
import { relativeTime } from '@/lib/utils';
import { Play } from 'lucide-react';

interface ReviewCardProps {
  rating: number;
  text:   string;
  tags?:  string[];
  createdAt?: string;
  author?: { display_name: string | null; handle: string | null } | null;
  hasVideo?: boolean;
}

export function ReviewCard({ rating, text, tags, createdAt, author, hasVideo }: ReviewCardProps) {
  const initial = (author?.display_name ?? author?.handle ?? 'U')[0]?.toUpperCase() ?? 'U';
  return (
    <article className="rounded-2xl border border-stone-200 bg-white p-4">
      <header className="mb-2 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-royal-gradient text-sm font-black text-white">
          {initial}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-royal-900">
              {author?.display_name ?? author?.handle ?? 'Anonymous'}
            </span>
            {hasVideo && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-gold-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold-700">
                <Play size={9} fill="currentColor" /> Video
              </span>
            )}
          </div>
          <span className="text-[11px] text-stone-500">{createdAt ? relativeTime(createdAt) : ''}</span>
        </div>
        <StarRating value={rating} size={13} label={false} />
        <span className="text-xs font-bold text-gold-600">{rating}/5</span>
      </header>

      <p className="whitespace-pre-line text-[14px] leading-relaxed text-royal-900/85">{text}</p>

      {tags && tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {tags.map((t) => (
            <span key={t} className="rounded-full bg-royal-50 px-2 py-0.5 text-[10px] font-bold text-royal-700">
              #{t}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}
