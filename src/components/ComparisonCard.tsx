import Link from 'next/link';
import { ShieldCheck, ArrowRight } from 'lucide-react';
import { StarRating } from '@/components/ui/StarRating';
import { formatCount, cn } from '@/lib/utils';
import type { ComparisonCard as ComparisonCardType } from '@/lib/types';

interface Props { card: ComparisonCardType; featured?: boolean; className?: string }

export function ComparisonCard({ card, featured, className }: Props) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border bg-white transition',
        featured ? 'border-royal-500 shadow-[0_12px_40px_rgba(10,71,165,0.15)]' : 'border-stone-200',
        className,
      )}
    >
      <div className="absolute -right-2 -top-2">
        <div className={cn(
          'flex h-9 w-9 items-center justify-center rounded-full text-xs font-black text-white shadow',
          featured ? 'bg-brand-gradient' : 'bg-royal-900',
        )}>
          #{card.rank}
        </div>
      </div>

      <div className="p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-royal-50 text-xl">🏢</div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate text-lg font-black text-royal-900">{card.business_name}</h3>
              <ShieldCheck size={14} className="shrink-0 text-royal-600" />
            </div>
            <p className="text-sm font-semibold text-royal-900/80">{card.headline}</p>
          </div>
          <div className="text-right">
            <StarRating value={card.rating} size={14} />
            <div className="text-[10px] font-semibold text-stone-500">
              {formatCount(card.review_count)} reviews
            </div>
          </div>
        </div>

        {card.summary && (
          <p className="mt-3 text-sm leading-relaxed text-stone-700">{card.summary}</p>
        )}

        {card.pull_quote && (
          <blockquote className="mt-3 rounded-xl border border-royal-100 bg-cream-50/60 p-3 text-sm italic text-royal-900/90">
            “{card.pull_quote}”
          </blockquote>
        )}

        <div className="mt-4 flex items-center justify-between">
          <span className="text-[11px] font-semibold text-stone-500">
            Cited {card.cited_review_ids.length} reviewer{card.cited_review_ids.length === 1 ? '' : 's'}
          </span>
          <Link
            href={`/business/${card.business_slug}`}
            className="inline-flex items-center gap-1 rounded-full bg-royal-900 px-3 py-1.5 text-xs font-black text-white transition hover:bg-royal-800"
          >
            Open {card.business_name} <ArrowRight size={12} />
          </Link>
        </div>
      </div>
    </div>
  );
}
