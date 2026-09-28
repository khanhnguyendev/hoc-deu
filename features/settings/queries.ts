import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireOnboarded, type SessionUser } from '@/lib/auth/dal'
import { loadTrackOptions } from '@/lib/content/track-options'
import type { Schedule } from '@/lib/domain/time/localDay'
import { timeZoneOptions } from '@/lib/domain/time/timeZones'
import type { Database } from '@/lib/supabase/database.types'
import { todayOf } from '@/lib/plans/reads'
import { createClient } from '@/lib/supabase/server'
import type { AiOverrideView } from './components/ai-overrides'
import { readAiOverrides } from './overrides'
import { readEnrollments, readScheduleVersions } from './reads'
import { sameSchedule, scheduleState } from './schedule'
import type { SettingsTrack } from './schema'

export type SettingsData = {
  /** `SessionUser` plus `shareNotesWithAi` (§4.6, task 6.7b: not on `SessionUser` itself). */
  user: SessionUser & { shareNotesWithAi: boolean }
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
  /**
   * "Điều chỉnh lộ trình bởi AI" (§5.12, task 6.6c): the learner's overrides in force, active or
   * suspended, whatever the AI flag; null when they could not be read (the section's error state
   * — the rest of the page still works).
   */
  aiOverrides: AiOverrideView[] | null
}

/** `readAiOverrides`, a failure logged (its name and message only) and answered null. */
async function aiOverridesOf(
  supabase: SupabaseClient<Database>,
  userId: string,
  today: string,
): Promise<AiOverrideView[] | null> {
  try {
    return await readAiOverrides(supabase, userId, today)
  } catch (error) {
    console.error(
      '[settings] overrides read failed:',
      error instanceof Error ? `${error.name}: ${error.message}` : typeof error,
    )
    return null
  }
}

/**
 * `profiles.share_notes_with_ai` (§4.6, task 6.7b): not on `SessionUser` (`lib/auth/dal`), so
 * read directly here — own read, own client, RLS applies (read own row).
 */
async function readShareNotesWithAi(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('share_notes_with_ai')
    .eq('id', userId)
    .single()
  if (error) throw new Error('Could not read notes sharing', { cause: error })
  return data.share_notes_with_ai
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
  const [versions, enrollments, shareNotesWithAi] = await Promise.all([
    readScheduleVersions(supabase, user.id),
    readEnrollments(supabase, user.id),
    readShareNotesWithAi(supabase, user.id),
  ])
  const { schedule, pending } = scheduleState(versions, now)
  const aiOverrides = await aiOverridesOf(supabase, user.id, todayOf(versions, now))
  return {
    user: { ...user, shareNotesWithAi },
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
    aiOverrides,
  }
}
