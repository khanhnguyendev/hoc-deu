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
