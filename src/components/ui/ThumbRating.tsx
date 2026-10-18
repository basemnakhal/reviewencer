import { cn } from '@/lib/utils';

export type ThumbValue = 1 | 3 | 5;

interface ThumbPickerProps {
  value: ThumbValue;
  onChange: (v: ThumbValue) => void;
}

export function ThumbPicker({ value, onChange }: ThumbPickerProps) {
  const options: { v: ThumbValue; label: string; active: string; circle: string; icon: React.ReactNode }[] = [
    {
      v: 5,
      label: 'Loved it',
      active: 'bg-green-50 border-green-500',
      circle: 'bg-green-500',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
          <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
        </svg>
      ),
    },
    {
      v: 3,
      label: "It's okay",
      active: 'bg-amber-50 border-amber-400',
      circle: 'bg-amber-400',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(-90deg)' }}>
          <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z" />
          <path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
        </svg>
      ),
    },
    {
      v: 1,
      label: 'Nope',
      active: 'bg-red-50 border-red-500',
      circle: 'bg-red-500',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z" />
          <path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
        </svg>
      ),
    },
  ]

  return (
    <div className="flex gap-3">
      {options.map(({ v, label, active, circle, icon }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={cn(
            'flex flex-1 flex-col items-center gap-2 rounded-2xl border-2 py-4 transition',
            value === v ? active : 'border-stone-200 bg-stone-50 hover:border-stone-300'
          )}
        >
          <div className={cn(
            'flex h-12 w-12 items-center justify-center rounded-full transition',
            value === v ? circle : 'bg-stone-200'
          )}
            style={{ stroke: value === v ? 'white' : '#9ca3af' }}
          >
            {icon}
          </div>
          <span className={cn(
            'text-xs font-semibold',
            value === v ? 'text-stone-800' : 'text-stone-500'
          )}>
            {label}
          </span>
        </button>
      ))}
    </div>
  )
}

export function ThumbRating({ value }: { value: ThumbValue }) {
  const map = {
    5: { label: 'Loved it', color: 'text-green-600' },
    3: { label: "It's okay", color: 'text-amber-500' },
    1: { label: 'Nope', color: 'text-red-500' },
  }
  const { label, color } = map[value]
  return <span className={cn('text-sm font-semibold', color)}>{label}</span>
}
