/**
 * Calendar math on local days (`YYYY-MM-DD`) in UTC, so the runtime time zone never shifts a day.
 * Weeks start on Monday (Vietnam). The pattern may not import lib/domain (platform design §7.2).
 */
const DAY_MS = 86_400_000

function toUtc(isoDay: string): number {
  const [y, m, d] = isoDay.split('-').map(Number)
  return Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1)
}

const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10)

export function addDays(isoDay: string, days: number): string {
  return fromUtc(toUtc(isoDay) + days * DAY_MS)
}

/** Monday 0 … Sunday 6. */
export function weekdayIndex(isoDay: string): number {
  return (new Date(toUtc(isoDay)).getUTCDay() + 6) % 7
}

export function startOfWeek(isoDay: string): string {
  return addDays(isoDay, -weekdayIndex(isoDay))
}

/** The first day of the month `months` away from the month of `isoDay`. */
export function addMonths(isoDay: string, months: number): string {
  const date = new Date(toUtc(isoDay))
  return fromUtc(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1))
}

/** The month of `isoDay` as Monday-first weeks; `null` pads the first and last week. */
export function monthGrid(isoDay: string): (string | null)[] {
  const first = addMonths(isoDay, 0)
  const next = addMonths(isoDay, 1)
  const cells: (string | null)[] = Array.from({ length: weekdayIndex(first) }, () => null)
  for (let day = first; day !== next; day = addDays(day, 1)) cells.push(day)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

/** `weeks` columns of Monday…Sunday ending with the week of `today`; days after today are `null`. */
export function yearColumns(today: string, weeks = 53): (string | null)[][] {
  const start = addDays(startOfWeek(today), -7 * (weeks - 1))
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const day = addDays(start, w * 7 + d)
      return day > today ? null : day
    }),
  )
}
