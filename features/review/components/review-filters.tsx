import { FilterChipGroup, FilterChipLink } from '@/components/patterns/filter-chip'
import { reviewHref } from '@/features/items/href'
import { vi } from '@/lib/i18n/vi'

const copy = vi.review.filters

export type ReviewFiltersTrack = {
  readonly id: string
  readonly title: string
  readonly count: number
}

/**
 * The `?track=` filter chips (§2.4): "Tất cả" (every eligible track's due count) plus one per
 * eligible track, each showing its own due count — `FilterChipLink`/`FilterChipGroup as="nav"`
 * (`components/patterns/filter-chip.tsx`), so this copies no class strings (task 5.3 review,
 * finding I4). Each is a real link with an `href` (`?track=`) — a Next.js client-side navigation
 * that changes the URL and re-renders `/review` with fresh server data, not a full browser
 * reload, but also never a client-state toggle (a plain link works with the browser's back
 * button, opening in a new tab, and so on) — the review round 1 fix corrected the earlier "a full
 * page load" wording (finding I2). `aria-current="page"` marks the one in force.
 */
function ReviewFilters({
  tracks,
  active,
}: {
  tracks: readonly ReviewFiltersTrack[]
  active: string | null
}) {
  const total = tracks.reduce((sum, track) => sum + track.count, 0)
  return (
    <FilterChipGroup as="nav" label={copy.label}>
      <FilterChipLink
        href={reviewHref(null)}
        label={copy.all}
        count={total}
        current={active === null}
      />
      {tracks.map((track) => (
        <FilterChipLink
          key={track.id}
          href={reviewHref(track.id)}
          label={track.title}
          count={track.count}
          current={track.id === active}
        />
      ))}
    </FilterChipGroup>
  )
}

export { ReviewFilters }
