import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { formatNumber } from '@/lib/i18n/format'
import { cn } from '@/lib/utils'

/**
 * A labelled number; numbers use the mono font with tabular figures (DESIGN_SYSTEM §9).
 * `tracking-tight` goes on a number only (§4.3, M1 #15): a text value such as "12,4 tuần" keeps
 * normal tracking, so Vietnamese diacritics never collide. With `href` the whole card is one link —
 * Card's `interactive` hover shadow and the link's focus ring (m-2: `/today`'s "Cần ôn hôm nay"
 * had copied Card's hover classes onto its own link).
 */
function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  href,
}: {
  label: string
  value: number | string
  hint?: string
  icon?: LucideIcon
  /** The whole card links here (e.g. the due reviews → `/review`). */
  href?: string
}) {
  const isNumber = typeof value === 'number'
  const card = (
    <Card data-slot="stat-card" interactive={href !== undefined} className="gap-1 md:gap-1">
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
  if (href === undefined) return card
  return (
    <Link href={href} data-slot="stat-card-link" className="block rounded-lg">
      {card}
    </Link>
  )
}

export { StatCard }
