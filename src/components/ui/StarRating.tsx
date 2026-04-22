import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StarRatingProps {
  value:    number;     // 0..5
  size?:    number;
  label?:   boolean;
  className?: string;
}

export function StarRating({ value, size = 16, label = true, className }: StarRatingProps) {
  const v = Math.max(0, Math.min(5, value));
  return (
    <span className={cn('inline-flex items-center gap-1 text-gold-600', className)}>
      <Star size={size} fill="currentColor" strokeWidth={0} />
      {label && <span className="font-bold tabular-nums">{v.toFixed(1)}</span>}
    </span>
  );
}
