import Link from 'next/link';
import { BusinessCard } from '@/components/BusinessCard';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { CATEGORIES, getCategory } from '@/lib/categories';
import type { BusinessCard as BusinessCardType } from '@/lib/types';

export const revalidate = 60;
export const metadata = { title: 'Categories — Reviewencer' };

interface Props { searchParams: { cat?: string } }

export default async function CategoriesPage({ searchParams }: Props) {
  const activeId = searchParams.cat ?? null;
  const supabase = createSupabaseServerClient();

  let q = supabase
    .from('business_cards')
    .select('*')
    .order('avg_rating', { ascending: false })
    .order('review_count', { ascending: false })
    .limit(24);

  if (activeId) q = q.eq('category_id', activeId);

  const { data } = await q;
  const businesses = (data ?? []) as BusinessCardType[];
  const activeCat = activeId ? getCategory(activeId) : null;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-12 pt-6">
      <header className="mb-6">
        <h1 className="text-2xl font-black text-royal-900">
          {activeCat ? `${activeCat.emoji} ${activeCat.label}` : 'Browse by category'}
        </h1>
        <p className="text-sm text-stone-600">
          {activeCat ? `Top ${activeCat.label.toLowerCase()} in the UAE, ranked by real reviews.` : 'Pick a category to explore UAE businesses.'}
        </p>
      </header>

      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href="/categories"
          className={pill(!activeId)}
        >
          All
        </Link>
        {CATEGORIES.map((c) => (
          <Link
            key={c.id}
            href={`/categories?cat=${c.id}`}
            className={pill(activeId === c.id)}
          >
            <span className="mr-1">{c.emoji}</span>{c.label}
          </Link>
        ))}
      </div>

      {businesses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-royal-200 bg-white/60 p-8 text-center text-sm text-stone-600">
          No businesses here yet.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {businesses.map((b) => <BusinessCard key={b.id} business={b} />)}
        </div>
      )}
    </div>
  );
}

function pill(active: boolean) {
  return `rounded-full px-3 py-1.5 text-xs font-black transition ${
    active
      ? 'bg-royal-900 text-white shadow'
      : 'border border-stone-200 bg-white text-royal-700 hover:border-royal-300'
  }`;
}
