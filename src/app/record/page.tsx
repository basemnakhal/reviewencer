import { redirect } from 'next/navigation';
import { RecordFlow } from '@/components/RecordFlow';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata = { title: 'Record a review — Reviewencer' };
export const dynamic = 'force-dynamic';

interface Props { searchParams: { business?: string } }

export default async function RecordPage({ searchParams }: Props) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/?signin=1&next=${encodeURIComponent('/record')}`);
  }

  const { data: businessRows } = await supabase
    .from('businesses')
    .select('id,name,slug,logo_emoji')
    .order('name', { ascending: true });

  const businesses = (businessRows ?? []).map((b) => ({
    id: b.id, name: b.name, slug: b.slug, emoji: b.logo_emoji,
  }));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <RecordFlow businesses={businesses} defaultBusinessId={searchParams.business} />
    </div>
  );
}
