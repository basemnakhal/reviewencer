import { TierBadge } from './TierBadge'

interface ReviewCardProps {
  reviewId: string;
  rating: number;
  text?: string;
  createdAt?: string;
  author?: { display_name: string | null; handle: string | null; tier?: string | null } | null;
  hasVideo?: boolean;
  businessName?: string;
  category?: string;
}

const VERDICT: Record<number, { label: string; emoji: string; color: string }> = {
  5: { label: 'Loved it', emoji: '👍', color: '#22c55e' },
  3: { label: "It's okay", emoji: '😐', color: '#eab308' },
  1: { label: 'Nope',     emoji: '👎', color: '#ef4444' },
}

export function ReviewCard({ reviewId, rating, text, author, hasVideo, businessName, category }: ReviewCardProps) {
  const verdict = VERDICT[rating] ?? VERDICT[3]
  const displayName = author?.display_name ?? author?.handle ?? 'Anonymous'

  const bizLine = [businessName, category].filter(Boolean).join(' · ')

  return (
    <a
      href={`/r/${reviewId}`}
      className="block rounded-2xl overflow-hidden border border-white/10 bg-[#0D1117] hover:border-white/20 transition-colors"
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-white/90">{displayName}</span>
        {author?.tier && <TierBadge tier={author.tier as any} variant="dark" />}
        <span className="text-xs text-[#FF7A00] font-semibold">· Reviewencer</span>
        {hasVideo && (
          <span className="ml-auto text-[10px] font-bold uppercase tracking-wide text-amber-400">▶ Video</span>
        )}
      </div>

      {/* Verdict */}
      <div className="px-4 pb-2">
        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold"
          style={{ backgroundColor: verdict.color + '22', color: verdict.color }}>
          {verdict.emoji} {verdict.label}
        </span>
      </div>

      {/* Business / category */}
      {bizLine && (
        <div className="px-4 pb-2 text-xs text-white/50">
          <span className="text-white/80 font-semibold">{businessName}</span>
          {category && <span> · {category}</span>}
        </div>
      )}

      {/* Review text */}
      {text && (
        <p className="px-4 pb-3 text-[13px] leading-relaxed text-white/70 line-clamp-3">
          &ldquo;{text}&rdquo;
        </p>
      )}

      {/* Footer */}
      <div className="px-4 py-2 border-t border-white/5 text-[11px] text-white/30">
        🔗 reviewencer.com
      </div>
    </a>
  )
}
