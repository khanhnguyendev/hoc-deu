import { canonicalTimeZone } from './timeZones'

/** A calendar date in the learner's schedule, `YYYY-MM-DD`. */
export type LocalDay = string
/** `HH:MM`, 00:00–12:00 in 30-minute steps (decision 5). */
export type DayStart = string
export type Schedule = { timezone: string; dayStartsAt: DayStart }
export type ScheduleVersion = Schedule & { effectiveAt: string /* ISO-8601 instant */ }

export const DEFAULT_SCHEDULE: Schedule = { timezone: 'Asia/Ho_Chi_Minh', dayStartsAt: '04:00' }

/** '00:00', '00:30', …, '12:00' — 25 values, 30-minute steps (decision 5). */
export const DAY_STARTS: readonly DayStart[] = Array.from({ length: 25 }, (_, i) => {
  const totalMinutes = i * 30
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
})

const MS_PER_DAY = 86_400_000
const MS_PER_MINUTE = 60_000
const FORWARD_SCAN_STEP_MS = 15 * MS_PER_MINUTE

/** Integer day number (days since the Unix epoch) for a UTC calendar date. */
function dayNumber(year: number, month: number, day: number): number {
  return Date.UTC(year, month - 1, day) / MS_PER_DAY
}

/** The `LocalDay` string for an integer day number (inverse of `dayNumber`). */
function dayNumberToLocalDay(days: number): LocalDay {
  const instant = new Date(days * MS_PER_DAY)
  const year = instant.getUTCFullYear()
  const month = instant.getUTCMonth() + 1
  const day = instant.getUTCDate()
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function requirePart(parts: readonly Intl.DateTimeFormatPart[], type: string): number {
  const found = parts.find((p) => p.type === type)
  if (found === undefined) {
    throw new Error(`formatToParts did not include a "${type}" part`)
  }
  return Number(found.value)
}

/**
 * The wall-clock reading of `instant` in `timeZone`, reinterpreted as a UTC instant (§5.1
 * algorithm notes). This is not `instant` itself — it is the "same digits, UTC" trick that lets
 * calendar arithmetic run entirely in `Date.UTC` integer math.
 */
function wallClockAsUtcMs(instant: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: canonicalTimeZone(timeZone),
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const parts = formatter.formatToParts(instant)
  return Date.UTC(
    requirePart(parts, 'year'),
    requirePart(parts, 'month') - 1,
    requirePart(parts, 'day'),
    requirePart(parts, 'hour'),
    requirePart(parts, 'minute'),
    requirePart(parts, 'second'),
  )
}

function parseDayStart(dayStartsAt: DayStart): { hour: number; minute: number } | null {
  const match = /^(\d{2}):(\d{2})$/.exec(dayStartsAt)
  if (match === null) return null
  const [, hourText, minuteText] = match
  if (hourText === undefined || minuteText === undefined) return null
  return { hour: Number(hourText), minute: Number(minuteText) }
}

function dayStartOffsetMs(dayStartsAt: DayStart): number {
  const parsed = parseDayStart(dayStartsAt)
  if (parsed === null) {
    throw new Error(`Not a valid day start: "${dayStartsAt}"`)
  }
  return (parsed.hour * 60 + parsed.minute) * MS_PER_MINUTE
}

/** Date part of (wall-clock time of `now` in `schedule.timezone` − `dayStartsAt`) — §5.1. */
export function localDay(now: Date, schedule: Schedule): LocalDay {
  const shifted = wallClockAsUtcMs(now, schedule.timezone) - dayStartOffsetMs(schedule.dayStartsAt)
  return dayNumberToLocalDay(Math.floor(shifted / MS_PER_DAY))
}

/** Latest version with effectiveAt ≤ at; DEFAULT_SCHEDULE when none (versions in any order). */
export function scheduleAt(versions: readonly ScheduleVersion[], at: Date): Schedule {
  const atMs = at.getTime()
  let best: ScheduleVersion | null = null
  let bestMs = -Infinity
  for (const version of versions) {
    const versionMs = new Date(version.effectiveAt).getTime()
    if (versionMs <= atMs && versionMs > bestMs) {
      best = version
      bestMs = versionMs
    }
  }
  if (best === null) return DEFAULT_SCHEDULE
  return { timezone: best.timezone, dayStartsAt: best.dayStartsAt }
}

/**
 * Earliest instant (whole minute) > now whose localDay is the day after localDay(now).
 *
 * Scans **forward linearly** in 15-minute steps, never a binary search: every current UTC offset
 * and every allowed day start is a multiple of 15 minutes, so the boundary instant always falls
 * exactly on the 15-minute raster — but `localDay` is not monotonic across a fall-back repeated
 * hour (a day start inside it is reached twice), and the earliest instant is the one that counts.
 */
export function nextDayStart(now: Date, schedule: Schedule): Date {
  const target = addDays(localDay(now, schedule), 1)
  const nowMs = now.getTime()
  // The first 15-minute-raster instant strictly after `now` (raster-aligned to the Unix epoch);
  // floor(nowMs / step) * step is always <= nowMs, so + step is always > nowMs.
  let candidateMs =
    Math.floor(nowMs / FORWARD_SCAN_STEP_MS) * FORWARD_SCAN_STEP_MS + FORWARD_SCAN_STEP_MS
  while (localDay(new Date(candidateMs), schedule) !== target) {
    candidateMs += FORWARD_SCAN_STEP_MS
  }
  return new Date(candidateMs)
}

export function addDays(day: LocalDay, days: number): LocalDay {
  const parsed = parseLocalDay(day)
  if (parsed === null) {
    throw new Error(`Not a valid local day: "${day}"`)
  }
  return dayNumberToLocalDay(dayNumber(parsed.year, parsed.month, parsed.day) + days)
}

/** `to` − `from`, in days. */
export function daysBetween(from: LocalDay, to: LocalDay): number {
  const fromParsed = parseLocalDay(from)
  const toParsed = parseLocalDay(to)
  if (fromParsed === null || toParsed === null) {
    throw new Error(`Not a valid local day: "${fromParsed === null ? from : to}"`)
  }
  return (
    dayNumber(toParsed.year, toParsed.month, toParsed.day) -
    dayNumber(fromParsed.year, fromParsed.month, fromParsed.day)
  )
}

function parseLocalDay(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (match === null) return null
  const [, yearText, monthText, dayText] = match
  if (yearText === undefined || monthText === undefined || dayText === undefined) return null
  return { year: Number(yearText), month: Number(monthText), day: Number(dayText) }
}

export function isLocalDay(value: string): boolean {
  const parsed = parseLocalDay(value)
  if (parsed === null) return false
  // Date.UTC normalises out-of-range components (e.g. 2026-02-30 -> 2026-03-02), so round-trip
  // and compare to reject anything that is not a real calendar date.
  return dayNumberToLocalDay(dayNumber(parsed.year, parsed.month, parsed.day)) === value
}

export function isDayStart(value: string): boolean {
  return (DAY_STARTS as readonly string[]).includes(value)
}
