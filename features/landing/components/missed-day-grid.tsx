import type { HeatLevel } from '@/components/patterns/calendar-heatmap/levels'
import { vi } from '@/lib/i18n/vi'
import { HeatCell } from './heat-cell'

const copy = vi.landing.missed

/** Six example weeks, Monday first, one string per week (digits are heat levels). Two blank days. */
const WEEKS = ['1212212', '2121321', '1220121', '2312112', '1211210', '2121312'] as const
const CELLS = WEEKS.flatMap((week, w) =>
  [...week].map((digit, d) => ({ key: `${w}-${d}`, level: Number(digit) as HeatLevel })),
)

/**
 * The band's static grid: six weeks × seven days of example data (DESIGN_SYSTEM §15), decorative
 * (`aria-hidden`); the visible caption carries the meaning.
 */
function MissedDayGrid() {
  return (
    <figure data-slot="missed-day-grid" className="flex w-full max-w-sm flex-col gap-2 lg:max-w-md">
      <div aria-hidden="true" className="flex flex-col gap-1.5 md:gap-2">
        <div className="grid grid-cols-7 gap-1.5 text-xs text-muted-foreground md:gap-2">
          {vi.heatmap.weekdays.map((day) => (
            <span key={day} className="text-center">
              {day}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5 md:gap-2">
          {CELLS.map(({ key, level }) => (
            <HeatCell key={key} size="grid" level={level} blank={level === 0} />
          ))}
        </div>
      </div>
      <figcaption className="text-sm text-muted-foreground">{copy.caption}</figcaption>
    </figure>
  )
}

export { MissedDayGrid }
