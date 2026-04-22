'use client';

import { useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { ChatInput } from '@/components/ChatInput';
import { ComparisonCard } from '@/components/ComparisonCard';
import type { ChatAnswer } from '@/lib/types';

interface Turn {
  role:   'user' | 'assistant';
  query?: string;
  answer?: ChatAnswer;
}

interface Props { initialQuery?: string; category?: string | null }

export function ChatPanel({ initialQuery, category }: Props) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, setPending] = useState(false);
  const [sessionId] = useState<string>(() => (typeof crypto !== 'undefined' ? crypto.randomUUID() : String(Math.random())));
  const viewportRef = useRef<HTMLDivElement>(null);

  // Run initial query on mount
  useEffect(() => { if (initialQuery) void ask(initialQuery); /* eslint-disable-next-line */ }, []);

  async function ask(q: string) {
    setTurns((t) => [...t, { role: 'user', query: q }]);
    setPending(true);
    try {
      const r = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, category, sessionId }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? 'Failed');
      setTurns((t) => [...t, { role: 'assistant', answer: data as ChatAnswer }]);
    } catch (e) {
      setTurns((t) => [...t, {
        role: 'assistant',
        answer: {
          prose: e instanceof Error ? e.message : 'Something went wrong.',
          comparison: [], follow_ups: [], cited_review_ids: [],
        },
      }]);
    } finally {
      setPending(false);
      setTimeout(() => viewportRef.current?.scrollTo({ top: viewportRef.current.scrollHeight, behavior: 'smooth' }), 60);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={viewportRef} className="flex-1 space-y-6 overflow-y-auto px-4 py-6">
        {turns.length === 0 && (
          <div className="rounded-2xl border border-dashed border-royal-200 bg-white/60 p-6 text-center text-sm text-stone-600">
            Type any question about a UAE business below.
          </div>
        )}

        {turns.map((t, i) => t.role === 'user' ? (
          <div key={i} className="flex justify-end">
            <div className="max-w-[80%] rounded-2xl bg-royal-900 px-4 py-2.5 text-sm font-semibold text-white shadow">
              {t.query}
            </div>
          </div>
        ) : (
          <AnswerBlock key={i} answer={t.answer!} onAsk={ask} />
        ))}

        {pending && <ThinkingIndicator />}
      </div>

      <div className="border-t border-stone-200 bg-cream-50/60 p-3">
        <ChatInput compact placeholder="Ask a follow-up…" onSubmit={ask} />
      </div>
    </div>
  );
}

function AnswerBlock({ answer, onAsk }: { answer: ChatAnswer; onAsk: (q: string) => void }) {
  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-royal-gradient text-white">
          <Sparkles size={14} />
        </div>
        <div className="flex-1 rounded-2xl bg-white p-4 text-[15px] leading-relaxed text-royal-900 shadow-sm ring-1 ring-stone-200">
          {answer.prose}
        </div>
      </div>

      {answer.comparison.length > 0 && (
        <div className="ml-11 space-y-3">
          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-royal-700">
            <Sparkles size={10} className="text-gold-500" /> Comparison — top {answer.comparison.length}
          </div>
          {answer.comparison.map((c, i) => (
            <ComparisonCard key={c.business_id + i} card={c} featured={c.rank === 1} />
          ))}
        </div>
      )}

      {answer.follow_ups.length > 0 && (
        <div className="ml-11 flex flex-wrap gap-1.5">
          {answer.follow_ups.map((q) => (
            <button
              key={q}
              onClick={() => onAsk(q)}
              className="rounded-full border border-royal-200 bg-royal-50 px-3 py-1.5 text-xs font-bold text-royal-700 hover:border-royal-500"
            >
              {q}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div className="ml-11 flex items-center gap-1.5 rounded-2xl bg-white px-4 py-2.5 text-stone-500 shadow-sm ring-1 ring-stone-200 w-fit">
      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-royal-500" />
      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-royal-500" />
      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-royal-500" />
      <span className="ml-1 text-xs font-semibold">Reading reviews…</span>
    </div>
  );
}
