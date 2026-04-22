import { ChatPanel } from '@/components/ChatPanel';
import { CategoryStrip } from '@/components/CategoryStrip';

interface Props {
  searchParams: { q?: string; cat?: string };
}

export const metadata = {
  title: 'Ask Reviewencer — AI answers for UAE businesses',
};

export default function AskPage({ searchParams }: Props) {
  const q   = searchParams.q   ?? '';
  const cat = searchParams.cat ?? null;

  return (
    <div className="mx-auto max-w-3xl px-4 pb-12 pt-6">
      <div className="mb-4">
        <h1 className="text-2xl font-black text-royal-900">Ask Reviewencer</h1>
        <p className="text-sm text-stone-600">
          AI-powered answers drawn from real, verified UAE reviews. Cite-backed. In plain English or Arabic.
        </p>
      </div>

      <div className="mb-4">
        <CategoryStrip activeId={cat} />
      </div>

      <div className="h-[calc(100vh-280px)] min-h-[520px] overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
        <ChatPanel initialQuery={q || undefined} category={cat} />
      </div>
    </div>
  );
}
