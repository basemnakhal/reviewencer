import Link from 'next/link';
import { CATEGORIES } from '@/lib/categories';
import { cn } from '@/lib/utils';

interface Props {
  activeId?: string | null;
  className?: string;
}

export function CategoryStrip({ activeId, className }: Props) {
  return (
    <nav
      className={cn('scroll-hide flex gap-2 overflow-x-auto px-1 py-2', className)}
      aria-label="Categories"
    >
      <Link
        href="/categories"
        className={cn(
          'shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition',
          !activeId
            ? 'border-royal-600 bg-royal-600 text-white'
            : 'border-stone-200 bg-white text-royal-900/80 hover:border-royal-300',
        )}
      >
        All
      </Link>
      {CATEGORIES.map((c) => (
        <Link
          key={c.id}
          href={`/categories?cat=${c.id}`}
          className={cn(
            'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition',
            activeId === c.id
              ? 'border-royal-600 bg-royal-600 text-white'
              : 'border-stone-200 bg-white text-royal-900/80 hover:border-royal-300',
          )}
        >
          <span aria-hidden>{c.emoji}</span> {c.label}
        </Link>
      ))}
    </nav>
  );
}
