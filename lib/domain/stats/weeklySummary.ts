/** §2.4 `/progress` weekly summary; decision 22: Monday–Sunday weeks. */
import type { DailyActivity } from '../state'
import { addDays, type LocalDay } from '../time/localDay'
import { weekStart } from '../time/weekday'

export type SummaryDay = {
  readonly localDay: LocalDay
  readonly minutesByTrack: Readonly<Record<string, number>>
  readonly minutes: number
  readonly itemsDone: number
  readonly completed: boolean
}

export type WeeklySummary = {
  readonly weekStart: LocalDay
  /** Monday … Sunday; a day without activity has zeros. */
  readonly days: readonly SummaryDay[]
  readonly minutesByTrack: Readonly<Record<string, number>>
  readonly totalMinutes: number
  readonly itemsDone: number
  readonly completedDays: number
}

/**
 * The Monday–Sunday week of `weekOf`; only `trackIds`' minutes count (removed tracks leave the
 * summaries, §5.9); `itemsDone` and `completed` are the day's own.
 */
export function weeklySummary(
  days: Readonly<Record<LocalDay, DailyActivity>>,
  weekOf: LocalDay,
  trackIds: ReadonlySet<string>,
): WeeklySummary {
  const start = weekStart(weekOf)
  const summaryDays: SummaryDay[] = []
  const weekMinutesByTrack: Record<string, number> = {}
  let totalMinutes = 0
  let itemsDone = 0
  let completedDays = 0

  for (let offset = 0; offset < 7; offset += 1) {
    const day = addDays(start, offset)
    const activity = days[day]
    const dayMinutesByTrack: Record<string, number> = {}
    let dayMinutes = 0
    if (activity !== undefined) {
      for (const [trackId, minutes] of Object.entries(activity.minutesByTrack)) {
        if (!trackIds.has(trackId)) continue
        dayMinutesByTrack[trackId] = minutes
        dayMinutes += minutes
        weekMinutesByTrack[trackId] = (weekMinutesByTrack[trackId] ?? 0) + minutes
      }
    }
    const dayItemsDone = activity?.itemsDone ?? 0
    const dayCompleted = activity?.completed ?? false
    summaryDays.push({
      localDay: day,
      minutesByTrack: dayMinutesByTrack,
      minutes: dayMinutes,
      itemsDone: dayItemsDone,
      completed: dayCompleted,
    })
    totalMinutes += dayMinutes
    itemsDone += dayItemsDone
    if (dayCompleted) completedDays += 1
  }

  return {
    weekStart: start,
    days: summaryDays,
    minutesByTrack: weekMinutesByTrack,
    totalMinutes,
    itemsDone,
    completedDays,
  }
}
