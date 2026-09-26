/**
 * `/progress` (platform design §2.4, §5.7, §5.9; Part B-M5 decision 24): the heatmap over all
 * history (removed tracks included), the streak, the requested week's summary (enrolled — active
 * and paused — tracks only) and week navigation. Pure: `today`, `days`, `versions`, `enrollments`
 * and `weekOf` all come in as plain data; `queries.ts` resolves catalog titles/accents first.
 */
import type { HeatmapDay } from '@/components/patterns/calendar-heatmap'
import { scheduleSkippedDays, streak } from '@/lib/domain/stats/streak'
import { weeklySummary, type WeeklySummary } from '@/lib/domain/stats/weeklySummary'
import type { DailyActivity } from '@/lib/domain/state'
import { addDays, type LocalDay, type ScheduleVersion } from '@/lib/domain/time/localDay'
import { weekStart } from '@/lib/domain/time/weekday'

/** A `user_tracks` row, resolved to its catalog title and accent (`queries.ts`). */
export type ProgressEnrollment = {
  readonly trackId: string
  readonly status: 'active' | 'paused' | 'removed'
  readonly title: string
  readonly accent: string
}

export type ProgressPage = {
  readonly today: LocalDay
  /** The last 53 weeks, all tracks' minutes (decision 24) — as many rows as `days` holds. */
  readonly heatmap: readonly HeatmapDay[]
  readonly streak: number
  readonly week: WeeklySummary
  readonly previousWeek: LocalDay
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

export function buildProgressPage(input: {
  readonly today: LocalDay
  readonly days: Readonly<Record<LocalDay, DailyActivity>>
  readonly versions: readonly ScheduleVersion[]
  readonly enrollments: readonly ProgressEnrollment[]
  readonly weekOf: LocalDay
}): ProgressPage {
  const { today, days, versions, enrollments, weekOf } = input

  const heatmap: HeatmapDay[] = Object.values(days).map((day) => ({
    day: day.localDay,
    minutes: totalMinutes(day.minutesByTrack),
  }))

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
  const requestedStart = weekStart(weekOf)
  const effectiveStart = requestedStart > thisWeekStart ? thisWeekStart : requestedStart
  const week = weeklySummary(days, effectiveStart, enrolledTrackIds)

  return {
    today,
    heatmap,
    streak: streakCount,
    week,
    previousWeek: addDays(effectiveStart, -7),
    nextWeek: effectiveStart === thisWeekStart ? null : addDays(effectiveStart, 7),
    tracks: enrolled.map((enrollment) => ({
      id: enrollment.trackId,
      title: enrollment.title,
      accent: enrollment.accent,
    })),
  }
}

/** `28/09 – 04/10` — a compact Monday..Sunday range for the weekly summary's heading. */
export function weekRangeLabel(weekOf: LocalDay): string {
  const start = weekStart(weekOf)
  const end = addDays(start, 6)
  const short = (day: LocalDay) => day.slice(8, 10) + '/' + day.slice(5, 7)
  return `${short(start)} – ${short(end)}`
}
