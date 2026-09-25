/** Weekday of a `LocalDay` (§2.4, decision 22): pure calendar math, no clock reads. */
import type { Weekday } from '../catalog'
import { addDays, daysBetween, type LocalDay } from './localDay'

/** Monday first, matching `TemplateDayKey` / `weeklyTemplate` ordering. */
export const WEEKDAYS: readonly Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

function weekdayAt(index: number): Weekday {
  const weekday = WEEKDAYS[index]
  if (weekday === undefined) {
    throw new Error(`Not a valid weekday index: ${index}`)
  }
  return weekday
}

/** Pure calendar math: `daysBetween('1970-01-05' (a Monday), day) mod 7`. */
export function weekdayOf(day: LocalDay): Weekday {
  const diff = daysBetween('1970-01-05', day)
  const index = ((diff % 7) + 7) % 7
  return weekdayAt(index)
}

/** The Monday on or before `day`. */
export function weekStart(day: LocalDay): LocalDay {
  const index = WEEKDAYS.indexOf(weekdayOf(day))
  return addDays(day, -index)
}
