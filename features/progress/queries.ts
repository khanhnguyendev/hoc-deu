/**
 * `/progress`'s loader (platform design §2.4; task 5.5). `requireOnboarded` first; every read goes
 * through `lib/plans/reads.ts` with the session client (own rows, RLS). Track titles/accents come
 * from the content catalog, as `features/roadmap/queries.ts` builds `TrackSummary` (decision 6).
 */
import 'server-only'
import { requireOnboarded } from '@/lib/auth/dal'
import { getCatalog } from '@/lib/content/catalog'
import { addDays, isLocalDay, type LocalDay } from '@/lib/domain/time/localDay'
import { planCatalog } from '@/lib/plans/catalog'
import {
  readDailyActivity,
  readEnrollments,
  readScheduleVersions,
  todayOf,
} from '@/lib/plans/reads'
import { createClient } from '@/lib/supabase/server'
import { buildProgressPage, type ProgressEnrollment, type ProgressPage } from './view-model'

/** The heatmap's window (decision 24): 53 weeks, today included. */
const HEATMAP_DAYS = 53 * 7

/** A real `LocalDay`, else null — an invalid or missing `?week=` falls back to this week. */
function parseWeekParam(value: string | undefined): LocalDay | null {
  return value !== undefined && isLocalDay(value) ? value : null
}

/** requireOnboarded; `?week=` a Monday not after this week, else this week. */
export async function getProgress(week: string | undefined): Promise<ProgressPage> {
  const user = await requireOnboarded()
  const supabase = await createClient()

  const versions = await readScheduleVersions(supabase, user.id)
  const today = todayOf(versions, new Date())

  const [enrollments, days] = await Promise.all([
    readEnrollments(supabase, user.id, planCatalog()),
    readDailyActivity(supabase, user.id, addDays(today, -(HEATMAP_DAYS - 1))),
  ])

  const trackInfo = new Map(getCatalog().tracks.map((track) => [track.id, track]))
  const progressEnrollments: ProgressEnrollment[] = enrollments.flatMap((enrollment) => {
    const track = trackInfo.get(enrollment.trackId)
    if (track === undefined) return []
    return [
      {
        trackId: enrollment.trackId,
        status: enrollment.status,
        title: track.title.vi,
        accent: track.accent,
      },
    ]
  })

  return buildProgressPage({
    today,
    days,
    versions,
    enrollments: progressEnrollments,
    weekOf: parseWeekParam(week) ?? today,
  })
}
