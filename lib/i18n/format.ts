/** Vietnamese number, duration and local-day formatting (DESIGN_SYSTEM §4.3). */

const LOCALE = 'vi-VN'
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/

/** `45 phút`, `1 giờ`, `1 giờ 15 phút`. */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} phút`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} giờ` : `${hours} giờ ${rest} phút`
}

/** vi-VN digits: decimal comma, thousands dot (`12,4`, `1.234`). */
export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(LOCALE, options).format(value)
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
