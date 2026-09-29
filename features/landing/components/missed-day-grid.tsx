import type { HeatLevel } from '@/components/patterns/calendar-heatmap/levels'
import { vi } from '@/lib/i18n/vi'
import { HeatCell } from './heat-cell'

const copy = vi.landing.missed

/** Six example weeks, Monday first, one string per week (digits are heat levels). Two blank days. */
const WEEKS = ['2332321', '3233232', '2320333', '1323323', '3233230', '2332323'] as const
const CELLS = WEEKS.flatMap((week, w) =>
  [...week].map((digit, d) => ({ key: `${w}-${d}`, level: Number(digit) as HeatLevel })),
)

/**
 * The band's static grid: six weeks × seven days of example data (DESIGN_SYSTEM §15), decorative
 * (`aria-hidden`); `summary` is what screen readers get instead.
 */
function MissedDayGrid() {
  return (
    <figure data-slot="missed-day-grid" className="flex flex-col gap-2">
      <div aria-hidden="true" className="grid grid-cols-7 gap-1.5 md:gap-2">
        {CELLS.map(({ key, level }) => (
          <HeatCell key={key} size="grid" level={level} />
        ))}
      </div>
      <p className="sr-only">{copy.summary}</p>
      <figcaption className="text-sm text-muted-foreground">{copy.caption}</figcaption>
    </figure>
  )
}

export { MissedDayGrid }
