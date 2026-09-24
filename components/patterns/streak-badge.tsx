import { Flame } from 'lucide-react'
import { formatNumber } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'

/** Streak: the number + Flame + "ngày liên tiếp" (DESIGN_SYSTEM §9). */
function StreakBadge({ days }: { days: number }) {
  return (
    <p data-slot="streak-badge" className="inline-flex items-baseline gap-2">
      <Flame aria-hidden="true" strokeWidth={1.75} className="size-6 self-center text-warning" />
      <span className="font-mono text-2xl font-bold tracking-tight tabular-nums md:text-4xl">
        {formatNumber(days)}
      </span>{' '}
      <span className="text-sm text-muted-foreground">{vi.streak.suffix}</span>
    </p>
  )
}

export { StreakBadge }
