type Tier = 'reviewer' | 'top_reviewer' | 'reviewencer'
type Variant = 'light' | 'dark'

export function TierBadge({ tier, variant = 'light' }: { tier: Tier; variant?: Variant }) {
  if (tier === 'reviewer') return null

  if (tier === 'reviewencer') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium text-white bg-brand-gradient whitespace-nowrap">
        Reviewencer
      </span>
    )
  }

  const colorClass = variant === 'dark'
    ? 'border-royal-300 text-royal-300'
    : 'border-royal-600 text-royal-600'

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border bg-transparent whitespace-nowrap ${colorClass}`}>
      Top Reviewer
    </span>
  )
}
