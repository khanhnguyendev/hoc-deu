import Link from 'next/link'
import { pillVariants } from '@/components/patterns/status-pill'
import { formatNumber } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'
import { cn } from '@/lib/utils'

const copy = vi.review.filters

export type ReviewFiltersTrack = {
  readonly id: string
  readonly title: string
  readonly count: number
}

/** `/review`, or `/review?track=<id>`. */
function chipHref(trackId: string | null): string {
  return trackId === null ? '/review' : `/review?${new URLSearchParams({ track: trackId })}`
}

/**
 * The `?track=` filter chips (§2.4): "Tất cả" (every active track's due count) plus one per
 * active track, each showing its own due count. Not `components/patterns/FilterChip` — that
 * pattern's `status` is one of the fixed `PillStatus` labels, not an arbitrary track id and
 * title, so this reuses only its visual mechanics (`pillVariants`, the same 44 px hit-area
 * technique) as plain navigation links (`?track=`, a real page load — never a client toggle), with
 * `aria-current="page"` marking the one in force.
 */
function ReviewFilters({
  tracks,
  active,
}: {
  tracks: readonly ReviewFiltersTrack[]
  active: string | null
}) {
  const total = tracks.reduce((sum, track) => sum + track.count, 0)
  const chips: ReviewFiltersTrack[] = [
    { id: '', title: copy.all, count: total },
    ...tracks.map((track) => ({ id: track.id, title: track.title, count: track.count })),
  ]
  return (
    <nav aria-label={copy.label} className="flex flex-wrap gap-x-2 gap-y-5">
      {chips.map((chip) => {
        const trackId = chip.id === '' ? null : chip.id
        const isActive = trackId === active
        return (
          <Link
            key={chip.id}
            href={chipHref(trackId)}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              pillVariants({ size: 'md' }),
              'relative bg-surface-muted text-foreground before:absolute before:inset-x-0 before:-inset-y-2',
              isActive && 'bg-primary-soft text-primary-soft-foreground ring-2 ring-primary',
            )}
          >
            {chip.title} <span className="font-mono tabular-nums">{formatNumber(chip.count)}</span>
          </Link>
        )
      })}
    </nav>
  )
}

export { ReviewFilters }
