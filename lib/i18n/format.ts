/** Vietnamese number, duration and local-day formatting (DESIGN_SYSTEM §4.3). */

const LOCALE = 'vi-VN'
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/

/** vi-VN digits: decimal comma, thousands dot (`12,4`, `1.234`). */
export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(LOCALE, options).format(value)
}

const minuteDigits = (value: number) => formatNumber(value, { maximumFractionDigits: 1 })

/**
 * `45 phút`, `1 giờ`, `1 giờ 15 phút`, `12,5 phút`. Missing, non-finite or negative values read as
 * `0 phút`, so a brand-new learner never sees "NaN phút" (RF-4).
 */
export function formatMinutes(minutes: number | null | undefined): string {
  const value = typeof minutes === 'number' && Number.isFinite(minutes) && minutes > 0 ? minutes : 0
  if (value < 60) return `${minuteDigits(value)} phút`
  const hours = Math.floor(value / 60)
  const rest = Math.round((value % 60) * 10) / 10
  return rest === 0
    ? `${formatNumber(hours)} giờ`
    : `${formatNumber(hours)} giờ ${minuteDigits(rest)} phút`
}

/**
 * A local day (`YYYY-MM-DD`) is a calendar date, not an instant: format it in UTC so the runtime's
 * time zone can never move it to the previous or next day.
 */
function utcOf(isoDay: string): number {
  const match = ISO_DAY.exec(isoDay)
  if (!match) throw new Error(`Expected a local day as YYYY-MM-DD, got "${isoDay}"`)
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

function format(isoDay: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(LOCALE, { ...options, timeZone: 'UTC' }).format(utcOf(isoDay))
}

const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase(LOCALE) + text.slice(1)

/** `3 tháng 2, 2026` */
export function formatDay(isoDay: string): string {
  return format(isoDay, { day: 'numeric', month: 'long', year: 'numeric' })
}

const pad = (value: string) => value.padStart(2, '0')

/**
 * The date (`formatDay`) and 24-hour time (`04:00`) an instant reads on a clock in `timeZone` —
 * e.g. when a schedule change takes effect, in the zone in force (§5.9). Independent of the
 * runtime's own zone.
 */
export function formatDayTimeIn(
  instant: string | Date,
  timeZone: string,
): { day: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(instant))
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? '00'
  return {
    day: formatDay(`${part('year')}-${pad(part('month'))}-${pad(part('day'))}`),
    time: `${pad(part('hour'))}:${pad(part('minute'))}`,
  }
}

/** `Thứ Ba, 3 tháng 2, 2026` */
export function formatDayLong(isoDay: string): string {
  return format(isoDay, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

/** `Tháng 2 năm 2026` */
export function formatMonth(isoDay: string): string {
  return capitalize(format(isoDay, { month: 'long', year: 'numeric' }))
}

/** `Th2` — compact month labels above the heatmap's year view (ICU's short form is `Tháng 2`). */
export function formatMonthShort(isoDay: string): string {
  return `Th${new Date(utcOf(isoDay)).getUTCMonth() + 1}`
}

/** `12,4 tuần` (§5.11 simulated-finish estimate); `fractionDigits` (default 1) is exact, not a max. */
export function formatWeeks(weeks: number, fractionDigits: 0 | 1 = 1): string {
  const value = formatNumber(weeks, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
  return `${value} tuần`
}

/**
 * `Với 60 phút/ngày, lộ trình 8 tuần thường hoàn thành sau ~12 tuần (90 %: ~12,4 tuần)` (§5.11):
 * the median rounds to whole weeks, the p90 keeps one decimal.
 */
export function formatFinishEstimate(input: {
  budgetMinutes: number
  variantLabel: string
  medianWeeks: number
  p90Weeks: number
}): string {
  const budget = `${formatNumber(input.budgetMinutes)} phút`
  const median = formatWeeks(input.medianWeeks, 0)
  const p90 = formatWeeks(input.p90Weeks)
  return `Với ${budget}/ngày, lộ trình ${input.variantLabel} thường hoàn thành sau ~${median} (90 %: ~${p90})`
}

/** `8w` → `8 tuần`; any other roadmap id is shown unchanged. */
export function variantLabel(variantId: string): string {
  const match = /^(\d+)w$/.exec(variantId)
  return match !== null ? `${match[1]} tuần` : variantId
}

/**
 * A `vi.ts` message with `{title}` (a track's title) filled in. A replacer function inserts the
 * title literally, so `$&` or `$1` in a title stay as written.
 */
export function withTitle(text: string, title: string): string {
  return text.replace('{title}', () => title)
}

/**
 * A `vi.ts` message with its `{name}` placeholders filled in literally (a replacer function); a
 * placeholder without an own value stays as written.
 */
export function fill(text: string, values: Readonly<Record<string, string | number>>): string {
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : match,
  )
}
