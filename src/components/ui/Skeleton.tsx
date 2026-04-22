import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-shimmer rounded-lg bg-[linear-gradient(90deg,#eef2f7_0%,#f8fafc_50%,#eef2f7_100%)] bg-[length:200%_100%]',
        className,
      )}
    />
  );
}
