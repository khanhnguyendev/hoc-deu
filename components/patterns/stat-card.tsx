import type { LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { formatNumber } from '@/lib/i18n/format'
import { cn } from '@/lib/utils'

/**
 * A labelled number; numbers use the mono font with tabular figures (DESIGN_SYSTEM §9).
 * `tracking-tight` goes on a number only (§4.3, M1 #15): a text value such as "12,4 tuần" keeps
 * normal tracking, so Vietnamese diacritics never collide.
 */
function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string
  value: number | string
  hint?: string
  icon?: LucideIcon
}) {
  const isNumber = typeof value === 'number'
  return (
    <Card data-slot="stat-card" className="gap-1 md:gap-1">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        {Icon && <Icon aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0" />}
        {label}
      </p>
      <p
        className={cn(
          'font-mono text-2xl font-semibold tabular-nums',
          isNumber && 'tracking-tight',
        )}
      >
        {isNumber ? formatNumber(value) : value}
      </p>
      {hint && <p className="text-xs text-subtle-foreground">{hint}</p>}
    </Card>
  )
}

export { StatCard }
