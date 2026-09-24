import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const RADIUS = 16
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

const ringVariants = cva('relative inline-flex shrink-0 items-center justify-center', {
  variants: {
    size: { sm: 'size-12 text-xs', md: 'size-16 text-sm', lg: 'size-24 text-lg' },
  },
  defaultVariants: { size: 'md' },
})

/**
 * Circular progress: `track` (needs a `data-accent` ancestor) for a track, `primary` for overall
 * progress (DESIGN_SYSTEM §9). The percentage is printed, so the ring is never colour alone.
 */
function ProgressRing({
  value,
  label,
  tone = 'primary',
  size = 'md',
}: {
  value: number
  label: string
  tone?: 'primary' | 'track'
  size?: 'sm' | 'md' | 'lg'
}) {
  const clamped = Math.round(Math.min(100, Math.max(0, value)))
  return (
    <div
      data-slot="progress-ring"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      className={ringVariants({ size })}
    >
      <svg viewBox="0 0 36 36" aria-hidden="true" className="size-full -rotate-90">
        <circle
          cx="18"
          cy="18"
          r={RADIUS}
          fill="none"
          strokeWidth="3"
          className="stroke-surface-sunken"
        />
        <circle
          cx="18"
          cy="18"
          r={RADIUS}
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - clamped / 100)}
          className={cn(tone === 'track' ? 'stroke-track' : 'stroke-primary')}
        />
      </svg>
      <span className="absolute font-mono font-semibold tabular-nums">{clamped}%</span>
    </div>
  )
}

export { ProgressRing }
