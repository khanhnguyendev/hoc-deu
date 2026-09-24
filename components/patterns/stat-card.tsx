import type { LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { formatNumber } from '@/lib/i18n/format'

/** A labelled number; numbers use the mono font with tabular figures (DESIGN_SYSTEM §9). */
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
  return (
    <Card data-slot="stat-card" className="gap-1 md:gap-1">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        {Icon && <Icon aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0" />}
        {label}
      </p>
      <p className="font-mono text-2xl font-semibold tracking-tight tabular-nums">
        {typeof value === 'number' ? formatNumber(value) : value}
      </p>
      {hint && <p className="text-xs text-subtle-foreground">{hint}</p>}
    </Card>
  )
}

export { StatCard }
