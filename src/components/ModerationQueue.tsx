'use client';

import { useState } from 'react';
import { StarRating } from '@/components/ui/StarRating';
import { AlertTriangle, Check, X, Play } from 'lucide-react';
import { relativeTime, cn } from '@/lib/utils';

interface Item {
  id: string;
  text: string;
  rating: number;
  tags: string[] | null;
  video_url: string | null;
  moderation_status: string;
  moderation_rationale: string | null;
  risk_categories: string[] | null;
  created_at: string;
  business: { name: string; slug: string; logo_emoji?: string | null } | null;
  author:   { display_name: string | null; handle: string | null } | null;
}

interface Props { initialItems: Item[] }

export function ModerationQueue({ initialItems }: Props) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [busy, setBusy]   = useState<string | null>(null);
  const [note, setNote]   = useState<Record<string, string>>({});

  async function decide(id: string, decision: 'publish' | 'reject') {
    setBusy(id);
    try {
      const r = await fetch('/api/moderation/decide', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ review_id: id, decision, note: note[id] ?? '' }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? 'Decision failed');
      setItems((arr) => arr.filter((it) => it.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Decision failed');
    } finally {
      setBusy(null);
    }
  }

  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-royal-200 bg-white/60 p-10 text-center text-sm text-stone-600">
        🎉 Queue is clear. No flagged reviews right now.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((it) => (
        <article key={it.id} className="overflow-hidden rounded-3xl border border-gold-300 bg-white shadow-sm">
          <header className="flex items-center justify-between bg-gold-50 px-4 py-2 text-xs">
            <div className="flex items-center gap-2 text-gold-800">
              <AlertTriangle size={14} />
              <span className="font-black uppercase tracking-wider">AI-flagged</span>
              <span className="text-gold-600">· {relativeTime(it.created_at)}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {(it.risk_categories ?? []).map((r) => (
                <span key={r} className="rounded-full bg-gold-200 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-gold-800">
                  {r.replace('_', ' ')}
                </span>
              ))}
            </div>
          </header>

          <div className="grid gap-4 p-4 md:grid-cols-[1fr_280px]">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="text-lg">{it.business?.logo_emoji ?? '🏢'}</span>
                <span className="font-black text-royal-900">{it.business?.name ?? 'Unknown'}</span>
                <StarRating value={it.rating} size={12} />
              </div>
              <p className="whitespace-pre-line text-sm leading-relaxed text-royal-900/90">
                {it.text}
              </p>
              <div className="mt-2 text-[11px] text-stone-500">
                By {it.author?.display_name ?? it.author?.handle ?? 'Anonymous'}
              </div>

              {it.video_url && (
                <a
                  href={it.video_url}
                  target="_blank" rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1 rounded-full bg-royal-50 px-3 py-1.5 text-xs font-bold text-royal-700"
                >
                  <Play size={12} /> View video
                </a>
              )}
            </div>

            <div className="rounded-2xl bg-stone-50 p-3">
              <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-royal-700">
                AI rationale
              </div>
              <p className="mb-3 text-[12px] leading-relaxed text-stone-700">
                {it.moderation_rationale ?? 'No rationale provided.'}
              </p>

              <textarea
                value={note[it.id] ?? ''}
                onChange={(e) => setNote((n) => ({ ...n, [it.id]: e.target.value }))}
                rows={2}
                placeholder="Optional moderator note…"
                className="w-full rounded-lg border border-stone-300 bg-white p-2 text-xs"
              />

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={() => decide(it.id, 'reject')}
                  disabled={busy === it.id}
                  className={cn(
                    'flex items-center justify-center gap-1 rounded-full border border-red-300 bg-white px-3 py-2 text-xs font-black text-red-700',
                    'hover:bg-red-50 disabled:opacity-50',
                  )}
                >
                  <X size={12} /> Reject
                </button>
                <button
                  onClick={() => decide(it.id, 'publish')}
                  disabled={busy === it.id}
                  className={cn(
                    'flex items-center justify-center gap-1 rounded-full bg-royal-900 px-3 py-2 text-xs font-black text-white',
                    'hover:bg-royal-800 disabled:opacity-50',
                  )}
                >
                  <Check size={12} /> Publish
                </button>
              </div>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
