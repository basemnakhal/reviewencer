import { notFound, redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Metadata } from 'next';
import { categoryLabel } from '@/lib/categories';

interface Props { params: { id: string } }

const VERDICT: Record<number, { label: string; emoji: string }> = {
  5: { label: 'Loved it', emoji: '👍' },
  3: { label: "It's okay", emoji: '😐' },
  1: { label: 'Nope',     emoji: '👎' },
}


async function fetchReview(id: string) {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from('reviews')
    .select(`
      id, rating, text, video_url, thumbnail_url, view_count, legit_count,
      business:businesses(name:name_en, slug, category:categories(slug)),
      author:profiles(display_name, handle)
    `)
    .eq('id', id)
    .maybeSingle();
  return data as any | null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const review = await fetchReview(params.id);
  if (!review) return { title: 'Review — Reviewencer' };

  const verdict = VERDICT[review.rating as 5 | 3 | 1] ?? VERDICT[3];
  const author = review.author?.display_name ?? review.author?.handle ?? 'Someone';
  const bizName = review.business?.name ?? '';
  const category = categoryLabel(review.business?.category?.slug);
  const bizLine = [bizName, category].filter(Boolean).join(' · ');

  const title = `${author} · Reviewencer 🎬`;
  const description = [
    `${verdict.emoji} ${verdict.label}`,
    bizLine,
    review.text ? `"${review.text}"` : null,
    "Championing UAE's world-class customer experience! 🇦🇪",
  ].filter(Boolean).join('\n');

  const url = `https://reviewencer.com/r/${params.id}`;
  const image = review.thumbnail_url ?? 'https://reviewencer.com/og-image.png';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      type: 'article',
      images: [{ url: image, width: 1080, height: 1920 }],
      ...(review.video_url ? { videos: [{ url: review.video_url, type: 'video/mp4' }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}

export default async function ReviewShortLink({ params }: Props) {
  const review = await fetchReview(params.id);
  if (!review) notFound();

  // Redirect to the full business page or detail route
  const slug = review.business?.slug;
  if (slug) {
    redirect(`/business/${slug}#review-${params.id}`);
  }
  redirect('/feed');
}
