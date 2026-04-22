import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ModerationQueue } from '@/components/ModerationQueue';
import type { Profile } from '@/lib/types';

export const metadata = { title: 'Moderation queue — Reviewencer' };
export const dynamic = 'force-dynamic';

export default async function ModerationPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/?signin=1&next=%2Fadmin%2Fmoderation');

  const { data: profileRow } = await supabase
    .from('profiles')
    .select('role,display_name,handle')
    .eq('id', user.id)
    .maybeSingle();

  const profile = profileRow as Pick<Profile, 'role' | 'display_name' | 'handle'> | null;
  if (!profile || (profile.role !== 'moderator' && profile.role !== 'admin')) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-2xl font-black text-royal-900">Access denied</h1>
        <p className="mt-2 text-sm text-stone-600">
          You need moderator privileges to view this page.
        </p>
      </div>
    );
  }

  // Server-side pre-fetch for snappy first paint; client component refreshes after.
  const { data: items } = await supabase
    .from('reviews')
    .select('id,text,rating,tags,video_url,moderation_status,moderation_rationale,risk_categories,created_at,business:businesses(name,slug,logo_emoji),author:profiles(display_name,handle)')
    .eq('moderation_status', 'flagged')
    .order('created_at', { ascending: true })
    .limit(50);

  return (
    <div className="mx-auto max-w-5xl px-4 pb-12 pt-6">
      <header className="mb-6">
        <h1 className="text-2xl font-black text-royal-900">Moderation queue</h1>
        <p className="text-sm text-stone-600">
          Reviews flagged by the AI moderator for UAE-law review. Signed in as {profile.display_name ?? profile.handle}.
        </p>
      </header>
      <ModerationQueue initialItems={(items ?? []) as any[]} />
    </div>
  );
}
