import Link from 'next/link';
import { Hero } from '@/components/Hero';
import { CategoryStrip } from '@/components/CategoryStrip';
import { BusinessCard } from '@/components/BusinessCard';
import { PhonePreview } from '@/components/PhonePreview';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { BusinessCard as BusinessCardType } from '@/lib/types';
import type { VideoReviewCardData } from '@/components/VideoReviewCard';

export const revalidate = 60;

export default async function HomePage() {
  const supabase = createSupabaseServerClient();

  // Top businesses by avg_rating from the business_cards view.
  const { data: cards } = await supabase
    .from('business_cards')
    .select('*')
    .order('avg_rating', { ascending: false })
    .order('review_count', { ascending: false })
    .limit(6);

  // Recent video reviews (for phone-frame rail).
  const { data: vids } = await supabase
    .from('feed_reviews')
    .select('*')
    .not('video_url', 'is', null)
    .eq('moderation_status', 'published')
    .order('published_at', { ascending: false })
    .limit(5);

  const businesses = (cards ?? []) as BusinessCardType[];
  const videoReviews: VideoReviewCardData[] = (vids ?? []).map((r: any) => ({
    id:        r.id,
    video_url: r.video_url,
    poster_url: r.poster_url,
    rating:    r.rating,
    text:      r.text,
    author: {
      display_name: r.author_display_name,
      handle:       r.author_handle,
      avatar_url:   r.author_avatar_url,
    },
    business: {
      name:     r.business_name,
      slug:     r.business_slug,
      emoji:    r.business_logo_emoji,
      verified: r.business_verified,
    },
    likes:    r.like_count ?? 0,
    comments: r.comment_count ?? 0,
  }));

  return (
    <div>
      {/* Hero */}
      <section className="relative">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 md:grid-cols-[1fr_320px] md:gap-10 md:py-12">
          <Hero />

          {/* Desktop phone preview — swipeable video feed */}
          <aside className="hidden md:flex md:items-center md:justify-center">
            <PhonePreview reviews={videoReviews} />
          </aside>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-7xl px-4">
        <CategoryStrip />
      </section>

      {/* Featured businesses */}
      <section className="mx-auto mt-10 max-w-7xl px-4">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-black text-royal-900">Top-rated this month</h2>
            <p className="text-sm text-stone-600">AI-summarized from real UAE reviewers.</p>
          </div>
          <Link href="/categories" className="text-xs font-bold text-royal-700 hover:underline">
            Browse all →
          </Link>
        </div>

        {businesses.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {businesses.map((b) => <BusinessCard key={b.id} business={b} />)}
          </div>
        )}
      </section>

      {/* Mobile video feed */}
      <section className="mx-auto mt-10 max-w-7xl px-4 md:hidden">
        <h2 className="mb-3 text-xl font-black text-royal-900">Video reviews</h2>
        {videoReviews.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="mx-auto w-full max-w-[340px]">
            <PhonePreview reviews={videoReviews} />
          </div>
        )}
      </section>

      {/* Trust strip */}
      <section className="mt-16 bg-royal-900 text-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-12 sm:grid-cols-3">
          <TrustItem title="Real reviewers" body="UAE phone-verified. No bots, no sock puppets." />
          <TrustItem title="AI that reads everything" body="Every business summary cites the reviews it was drawn from." />
          <TrustItem title="UAE-legal by design" body="Moderated against Federal Decree-Law 34/2021 before going live." />
        </div>
      </section>
    </div>
  );
}

function TrustItem({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <div className="mb-1 text-sm font-black uppercase tracking-widest text-gold-400">{title}</div>
      <div className="text-sm text-white/80">{body}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-royal-200 bg-white/60 p-8 text-center text-sm text-stone-600">
      Nothing here yet — seed the database or be the first to leave a review.
    </div>
  );
}
