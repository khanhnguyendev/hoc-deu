/**
 * `/progress` (platform design §2.4, §5.7, §5.9; Part B-M5 decision 24): the heatmap over the last
 * 53 weeks (removed tracks included), the streak over the shared window (`window.ts`, m-7), the
 * requested week's summary (enrolled — active and paused — tracks only), which week that is, and
 * week navigation within the history read. Pure: `today`, `days`, `versions`, `enrollments` and
 * `weekOf` all come in as plain data; `queries.ts` resolves catalog titles/accents first.
 */
import type { HeatmapDay } from '@/components/patterns/calendar-heatmap'
import { scheduleSkippedDays, streak } from '@/lib/domain/stats/streak'
import { weeklySummary, type WeeklySummary } from '@/lib/domain/stats/weeklySummary'
import type { DailyActivity } from '@/lib/domain/state'
import { addDays, type LocalDay, type ScheduleVersion } from '@/lib/domain/time/localDay'
import { weekStart } from '@/lib/domain/time/weekday'
import { activityWindowStart, HEATMAP_DAYS } from './window'

/** A `user_tracks` row, resolved to its catalog title and accent (`queries.ts`). */
export type ProgressEnrollment = {
  readonly trackId: string
  readonly status: 'active' | 'paused' | 'removed'
  readonly title: string
  readonly accent: string
}

/** The week shown, relative to now: it names the week ("Tuần này", "Tuần trước", its dates). */
export type WeekRelation = 'current' | 'previous' | 'earlier'

export type ProgressPage = {
  readonly today: LocalDay
  /** The last 53 weeks, all tracks' minutes (decision 24) — the rows `days` holds in them. */
  readonly heatmap: readonly HeatmapDay[]
  readonly streak: number
  readonly week: WeeklySummary
  /** Which week `week` is (UI I-4): only the current one reads "tuần này". */
  readonly relation: WeekRelation
  /** Null at the first whole week of the history read (m-7). */
  readonly previousWeek: LocalDay | null
  /** Null for the current week. */
  readonly nextWeek: LocalDay | null
  readonly tracks: readonly {
    readonly id: string
    readonly title: string
    readonly accent: string
  }[]
}

function totalMinutes(minutesByTrack: Readonly<Record<string, number>>): number {
  return Object.values(minutesByTrack).reduce((sum, minutes) => sum + minutes, 0)
}

const ENROLLED_STATUSES: readonly ProgressEnrollment['status'][] = ['active', 'paused']

/** The first Monday on or after the first day read: the earliest week whose days were all read. */
function earliestWeek(today: LocalDay): LocalDay {
  const first = activityWindowStart(today)
  const monday = weekStart(first)
  return monday === first ? monday : addDays(monday, 7)
}

// LocalDay is a zero-padded `YYYY-MM-DD` string: string order is chronological order.
const clampDay = (day: LocalDay, min: LocalDay, max: LocalDay): LocalDay =>
  day < min ? min : day > max ? max : day

function relationOf(weekStartDay: LocalDay, thisWeekStart: LocalDay): WeekRelation {
  if (weekStartDay === thisWeekStart) return 'current'
  return weekStartDay === addDays(thisWeekStart, -7) ? 'previous' : 'earlier'
}

export function buildProgressPage(input: {
  readonly today: LocalDay
  readonly days: Readonly<Record<LocalDay, DailyActivity>>
  readonly versions: readonly ScheduleVersion[]
  readonly enrollments: readonly ProgressEnrollment[]
  readonly weekOf: LocalDay
}): ProgressPage {
  const { today, days, versions, enrollments, weekOf } = input

  const heatmapStart = addDays(today, -(HEATMAP_DAYS - 1))
  const heatmap: HeatmapDay[] = Object.values(days)
    .filter((day) => day.localDay >= heatmapStart)
    .map((day) => ({ day: day.localDay, minutes: totalMinutes(day.minutesByTrack) }))

  const completedDays = new Set<LocalDay>()
  for (const day of Object.values(days)) {
    if (day.completed) completedDays.add(day.localDay)
  }
  const streakCount = streak({
    completedDays,
    today,
    skippedDays: scheduleSkippedDays(versions),
  })

  const enrolled = enrollments.filter((enrollment) => ENROLLED_STATUSES.includes(enrollment.status))
  const enrolledTrackIds = new Set(enrolled.map((enrollment) => enrollment.trackId))
  const thisWeekStart = weekStart(today)
  const firstWeekStart = earliestWeek(today)
  // A future ?week= reads as this week; one before the history read, as its first whole week —
  // never a week of zeros although the learner studied then (m-7).
  const effectiveStart = clampDay(weekStart(weekOf), firstWeekStart, thisWeekStart)
  const week = weeklySummary(days, effectiveStart, enrolledTrackIds)

  return {
    today,
    heatmap,
    streak: streakCount,
    week,
    relation: relationOf(effectiveStart, thisWeekStart),
    previousWeek: effectiveStart === firstWeekStart ? null : addDays(effectiveStart, -7),
    nextWeek: effectiveStart === thisWeekStart ? null : addDays(effectiveStart, 7),
    tracks: enrolled.map((enrollment) => ({
      id: enrollment.trackId,
      title: enrollment.title,
      accent: enrollment.accent,
    })),
  }
}

/** `28/09 – 04/10` — a compact Monday..Sunday range for the week's heading. */
export function weekRangeLabel(weekOf: LocalDay): string {
  const start = weekStart(weekOf)
  const end = addDays(start, 6)
  const short = (day: LocalDay) => day.slice(8, 10) + '/' + day.slice(5, 7)
  return `${short(start)} – ${short(end)}`
}
