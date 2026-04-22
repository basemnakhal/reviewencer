'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  placeholder?: string;
  initialValue?: string;
  compact?:     boolean;
  onSubmit?:    (q: string) => void;
  className?:   string;
}

/**
 * The hero Ask input. When no `onSubmit` is provided, submitting navigates
 * to `/ask?q=...` where the full ChatPanel takes over.
 */
export function ChatInput({ placeholder = 'Ask anything about UAE businesses…', initialValue = '', compact, onSubmit, className }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [pending, startTransition] = useTransition();

  function submit() {
    const q = value.trim();
    if (!q) return;
    if (onSubmit) { onSubmit(q); return; }
    startTransition(() => router.push(`/ask?q=${encodeURIComponent(q)}`));
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); submit(); }}
      className={cn(
        'group flex items-center gap-2 rounded-2xl border border-stone-200 bg-white p-1.5 shadow-[0_8px_30px_rgba(10,71,165,0.08)] focus-within:border-royal-600 focus-within:ring-4 focus-within:ring-royal-100',
        compact ? 'text-sm' : 'text-base',
        className,
      )}
    >
      <div className={cn('ml-1 flex shrink-0 items-center justify-center rounded-xl bg-royal-gradient text-white', compact ? 'h-9 w-9' : 'h-11 w-11')}>
        <Sparkles size={compact ? 16 : 20} />
      </div>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className={cn('flex-1 bg-transparent outline-none placeholder:text-stone-400', compact ? 'px-2 py-2' : 'px-2 py-3')}
      />
      <button
        type="submit"
        disabled={pending || !value.trim()}
        className={cn(
          'flex items-center gap-1 rounded-xl bg-royal-900 font-black text-white transition hover:bg-royal-800 disabled:opacity-40',
          compact ? 'px-3 py-2 text-xs' : 'px-4 py-3 text-sm',
        )}
      >
        {pending ? '…' : (<>Ask <ArrowRight size={compact ? 12 : 14} /></>)}
      </button>
    </form>
  );
}
