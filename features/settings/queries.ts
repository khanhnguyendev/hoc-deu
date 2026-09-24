import 'server-only'
import { requireOnboarded, type SessionUser } from '@/lib/auth/dal'
import { loadTrackOptions } from '@/lib/content/track-options'
import type { Schedule } from '@/lib/domain/time/localDay'
import { timeZoneOptions } from '@/lib/domain/time/timeZones'
import { createClient } from '@/lib/supabase/server'
import { readEnrollments, readScheduleVersions } from './reads'
import { sameSchedule, scheduleState } from './schedule'
import type { SettingsTrack } from './schema'

export type SettingsData = {
  user: SessionUser
  /** The schedule in force now. */
  schedule: Schedule
  /** The next version, when it differs from the schedule in force (§5.9). */
  pendingSchedule: (Schedule & { effectiveAt: string }) | null
  /** Every active track, in manifest order, with the learner's enrollment (or `null`). */
  tracks: SettingsTrack[]
  /** Canonical IANA ids, from the server's ICU: the browser's list may differ (decision 6). */
  timeZones: readonly string[]
  /** The server's clock (ISO-8601): today and the start-date range are computed from it. */
  now: string
  /** A fresh UUID per render (decision 9): every event id of a save derives from it. */
  requestId: string
}

/**
 * Everything `/settings` shows (§2.4): the schedule in force and the pending change, the active
 * tracks with the learner's enrollments, and the page's per-render `requestId`. A successful
 * save revalidates the page, so the next render brings a new `requestId`.
 */
export async function getSettingsData(): Promise<SettingsData> {
  const user = await requireOnboarded()
  const supabase = await createClient()
  const now = new Date()
  const [versions, enrollments] = await Promise.all([
    readScheduleVersions(supabase, user.id),
    readEnrollments(supabase, user.id),
  ])
  const { schedule, pending } = scheduleState(versions, now)
  return {
    user,
    schedule,
    pendingSchedule: pending !== null && !sameSchedule(pending, schedule) ? pending : null,
    tracks: loadTrackOptions().map((option) => {
      const row = enrollments.find((enrollment) => enrollment.trackId === option.id)
      return {
        option,
        enrollment:
          row === undefined
            ? null
            : {
                status: row.status,
                budgetMinutes: row.budgetMinutes,
                roadmapVariant: row.roadmapVariant,
                startDate: row.startDate,
              },
      }
    }),
    timeZones: timeZoneOptions(),
    now: now.toISOString(),
    requestId: crypto.randomUUID(),
  }
}
