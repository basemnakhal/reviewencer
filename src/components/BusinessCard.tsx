import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { StarRating } from '@/components/ui/StarRating';
import { formatCount, cn } from '@/lib/utils';
import type { BusinessCard as BusinessCardType } from '@/lib/types';
import { getCategory } from '@/lib/categories';

interface Props { business: BusinessCardType; className?: string }

export function BusinessCard({ business, className }: Props) {
  const cat = getCategory(business.category_id);
  return (
    <Link
      href={`/business/${business.slug}`}
      className={cn(
        'group block overflow-hidden rounded-2xl border border-stone-200 bg-white transition hover:-translate-y-0.5 hover:border-royal-300 hover:shadow-lg',
        className,
      )}
    >
      <div className="flex items-start gap-3 p-4">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl text-white shadow-inner"
          style={{ background: business.brand_color ?? '#0A47A5' }}
        >
          <span aria-hidden>{business.logo_emoji ?? cat?.emoji ?? '🏢'}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate font-black text-royal-900">{business.name}</h3>
            {business.verified && (
              <ShieldCheck size={14} className="shrink-0 text-royal-600" aria-label="Verified" />
            )}
          </div>
          <p className="line-clamp-2 text-xs text-stone-600">{business.tagline}</p>
        </div>
        <StarRating value={business.avg_rating} size={14} />
      </div>

      {business.ai_headline && (
        <div className="border-t border-stone-100 bg-cream-50/60 px-4 py-2 text-[11px] font-semibold italic text-royal-900/80">
          <span className="mr-1 text-gold-600">✨</span>
          {business.ai_headline}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-stone-100 px-4 py-2 text-[11px] font-semibold text-stone-500">
        <span>{formatCount(business.review_count)} reviews</span>
        {cat && <span className="rounded-full bg-royal-50 px-2 py-0.5 text-royal-700">{cat.label}</span>}
      </div>
    </Link>
  );
}
