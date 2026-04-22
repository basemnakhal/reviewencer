import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ShieldCheck, Video } from 'lucide-react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ReviewCard } from '@/components/ReviewCard';
import { ProfileEditor } from '@/components/ProfileEditor';
import type { Profile } from '@/lib/types';

export const metadata = { title: 'My profile — Reviewencer' };
export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/?signin=1&next=%2Fprofile');

  const { data: profileRow } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  const profile = profileRow as Profile | null;

  const { data: myReviews } = await supabase
    .from('reviews')
    .select('id,rating,text,tags,created_at,moderation_status,video_url,business:businesses(name,slug,logo_emoji)')
    .eq('author_id', user.id)
    .order('created_at', { ascending: false })
    .limit(30);

  const reviews = (myReviews ?? []) as any[];
  const published = reviews.filter((r) => r.moderation_status === 'published');
  const pending   = reviews.filter((r) => r.moderation_status !== 'published');

  return (
    <div className="mx-auto max-w-4xl px-4 pb-12 pt-6">
      <div className="mb-6 flex items-start gap-4 rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-royal-gradient text-2xl font-black text-white">
          {(profile?.display_name ?? profile?.handle ?? 'U')[0]?.toUpperCase()}
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-black text-royal-900">
            {profile?.display_name ?? profile?.handle ?? 'Reviewer'}
          </h1>
          <p className="text-xs text-stone-500">+{user.phone ?? '—'}</p>
          {profile?.role !== 'user' && (
            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-gold-100 px-2 py-0.5 text-[11px] font-black uppercase tracking-wider text-gold-700">
              <ShieldCheck size={12} /> {profile?.role}
            </span>
          )}
        </div>
        <Link
          href="/record"
          className="inline-flex items-center gap-1 rounded-full bg-brand-gradient px-4 py-2 text-xs font-black text-white shadow hover:brightness-105"
        >
          <Video size={14} /> New review
        </Link>
      </div>

      <ProfileEditor
        initial={{
          handle:       profile?.handle       ?? '',
          display_name: profile?.display_name ?? '',
          avatar_url:   profile?.avatar_url   ?? '',
        }}
      />

      <Section title={`Published (${published.length})`}>
        {published.length === 0 ? <Empty msg="No published reviews yet." /> : (
          <div className="grid gap-3 sm:grid-cols-2">
            {published.map((r) => (
              <ReviewCard
                key={r.id}
                rating={r.rating}
                text={r.text}
                tags={r.tags}
                createdAt={r.created_at}
                author={{ display_name: profile?.display_name ?? null, handle: profile?.handle ?? null }}
                hasVideo={!!r.video_url}
              />
            ))}
          </div>
        )}
      </Section>

      <Section title={`In moderation (${pending.length})`}>
        {pending.length === 0 ? <Empty msg="Everything you've posted is live." /> : (
          <div className="grid gap-3 sm:grid-cols-2">
            {pending.map((r) => (
              <div key={r.id} className="rounded-2xl border border-gold-200 bg-gold-50/70 p-4 text-sm">
                <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-gold-700">
                  {r.moderation_status.replace('_', ' ')}
                </div>
                <p className="line-clamp-4 text-royal-900/90">{r.text}</p>
              </div>
            ))}
          </div>
        )}
      </Section>

      <form action="/api/auth/signout" method="post" className="mt-8">
        <button className="text-xs font-bold text-stone-500 hover:text-red-600 hover:underline">
          Sign out
        </button>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-black uppercase tracking-wider text-royal-700">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-royal-200 bg-white/60 p-6 text-center text-sm text-stone-600">
      {msg}
    </div>
  );
}
