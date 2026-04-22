import { PhonePreview } from '@/components/PhonePreview';
import { ReviewCard } from '@/components/ReviewCard';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { VideoReviewCardData } from '@/components/VideoReviewCard';

export const revalidate = 30;
export const metadata = { title: 'Feed — Reviewencer' };

export default async function FeedPage() {
  const supabase = createSupabaseServerClient();

  const { data: rows } = await supabase
    .from('feed_reviews')
    .select('*')
    .eq('moderation_status', 'published')
    .order('published_at', { ascending: false })
    .limit(40);

  const all  = (rows ?? []) as any[];
  const vids = all.filter((r) => r.video_url);

  const videoReviews: VideoReviewCardData[] = vids.map((r) => ({
    id:        r.id,
    video_url: r.video_url,
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
    <div className="mx-auto max-w-6xl px-4 pb-12 pt-6">
      <header className="mb-6">
        <h1 className="text-2xl font-black text-royal-900">Reviewencer Feed</h1>
        <p className="text-sm text-stone-600">The newest UAE reviews — video-first.</p>
      </header>

      <div className="grid gap-8 md:grid-cols-[320px_1fr]">
        <div className="mx-auto md:mx-0">
          <PhonePreview reviews={videoReviews} />
        </div>

        <div>
          <h2 className="mb-3 text-sm font-black uppercase tracking-wider text-royal-700">
            Latest text reviews
          </h2>
          {all.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-royal-200 bg-white/60 p-8 text-center text-sm text-stone-600">
              Nothing published yet.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {all.slice(0, 20).map((r) => (
                <ReviewCard
                  key={r.id}
                  rating={r.rating}
                  text={r.text}
                  tags={r.tags}
                  createdAt={r.published_at ?? r.created_at}
                  author={{ display_name: r.author_display_name, handle: r.author_handle }}
                  hasVideo={!!r.video_url}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
