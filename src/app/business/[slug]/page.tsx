import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ShieldCheck, ArrowLeft } from 'lucide-react';
import { StarRating } from '@/components/ui/StarRating';
import { AiSummary } from '@/components/AiSummary';
import { ReviewCard } from '@/components/ReviewCard';
import { VideoReviewCard, type VideoReviewCardData } from '@/components/VideoReviewCard';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCategory } from '@/lib/categories';
import { formatCount } from '@/lib/utils';
import type { Business, AiSummary as AiSummaryType } from '@/lib/types';
import { BusinessLogo } from '@/components/BusinessLogo';

interface Props { params: { slug: string } }

export const revalidate = 30;

export async function generateMetadata({ params }: Props) {
  const supabase = createSupabaseServerClient();
  const { data: b } = await supabase
    .from('business_cards')
    .select('name,tagline')
    .eq('slug', params.slug)
    .maybeSingle();
  if (!b) return { title: 'Business — Reviewencer' };
  return {
    title:       `${b.name} reviews — Reviewencer`,
    description: b.tagline ?? undefined,
  };
}

export default async function BusinessPage({ params }: Props) {
  const supabase = createSupabaseServerClient();

  const { data: biz } = await supabase
    .from('business_cards')
    .select('id,slug,name,tagline,logo_url,verified,category_id,category_label')
    .eq('slug', params.slug)
    .maybeSingle();

  if (!biz) notFound();

  const business = biz as Business;
  const cat      = getCategory(business.category_id);

  const [{ data: summaryRow }, { data: reviewRows }] = await Promise.all([
    supabase.from('ai_summaries').select('*').eq('business_id', business.id).maybeSingle(),
    supabase
      .from('reviews')
      .select('id,rating,text,tags,created_at,video_url,author:profiles(display_name,handle,avatar_url,tier)')
      .eq('business_id', business.id)
      .eq('moderation_status', 'published')
      .order('published_at', { ascending: false })
      .limit(30),
  ]);

  const summary = summaryRow as AiSummaryType | null;
  const reviews = (reviewRows ?? []) as any[];
  const videoReviews: VideoReviewCardData[] = reviews
    .filter((r) => r.video_url)
    .slice(0, 4)
    .map((r) => ({
      id:         r.id,
      video_url:  r.video_url,
      poster_url: null,
      rating:     r.rating,
      text:       r.text,
      author:     r.author,
      business: {
        name:     business.name,
        slug:     business.slug,
        logo:     business.logo_url,
        verified: business.verified,
      },
    }));

  const avg =
    reviews.length > 0
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      : 0;

  return (
    <div className="mx-auto max-w-5xl px-4 pb-12 pt-6">
      <Link href="/" className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-royal-700 hover:underline">
        <ArrowLeft size={12} /> Back
      </Link>

      {/* Header */}
      <header className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-stone-200">
        <div className="bg-brand-gradient px-6 py-6 text-white">
          <div className="flex items-center gap-4">
            <div
              className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-white/20 text-3xl shadow-lg"
            >
              <BusinessLogo logo={business.logo_url} fallback={cat?.emoji} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-2xl font-black">{business.name}</h1>
                {business.verified && <ShieldCheck size={18} className="text-white/90" />}
              </div>
              <p className="text-sm text-white/85">{business.tagline ?? business.category_label}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 backdrop-blur">
              <StarRating value={avg} size={13} />
              <span className="font-black">{avg.toFixed(1)}</span>
              <span className="text-white/70">· {formatCount(reviews.length)} reviews</span>
            </div>
            <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold backdrop-blur">
              {cat?.emoji ?? '🏷️'} {cat?.label ?? business.category_label}
            </span>
          </div>
        </div>
      </header>

      {/* AI Summary */}
      {summary && (
        <div className="mt-6">
          <AiSummary summary={summary} businessName={business.name} />
        </div>
      )}

      {/* Video reviews row */}
      {videoReviews.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-black text-royal-900">Video reviews</h2>
          <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-4">
            {videoReviews.map((v) => (
              <div key={v.id} className="snap-start shrink-0">
                <div className="h-[520px] w-[290px]">
                  <VideoReviewCard review={v} active />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* All reviews */}
      <section className="mt-8">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-lg font-black text-royal-900">Recent reviews</h2>
          <Link
            href={`/record?business=${business.id}`}
            className="rounded-full bg-royal-900 px-4 py-2 text-xs font-black text-white hover:bg-royal-800"
          >
            Leave a review
          </Link>
        </div>

        {reviews.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-royal-200 bg-white/60 p-8 text-center text-sm text-stone-600">
            Be the first to review {business.name}.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {reviews.map((r) => (
              <ReviewCard
                key={r.id}
                reviewId={r.id}
                rating={r.rating}
                text={r.text}
                createdAt={r.created_at}
                author={r.author}
                hasVideo={!!r.video_url}
                businessName={business.name}
                category={cat?.label ?? business.category_label}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
