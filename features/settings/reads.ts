/**
 * The learner's own rows that settings reads (§4.1, RLS: read own), through the caller's client.
 * No guard of their own: the callers — `getSettingsData` and the settings actions — are guarded
 * (`requireOnboarded`) and pass the signed-in user's client and id.
 */
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { LocalDay } from '@/lib/domain/time/localDay'
import type { Database } from '@/lib/supabase/database.types'
import type { Enrollment, EnrollmentStatus } from './schema'

/** One copy of the schedule reader: the plan service's (task 5.1a). */
export { readScheduleVersions } from '@/lib/plans/reads'

type Client = SupabaseClient<Database>

const STATUSES: readonly EnrollmentStatus[] = ['active', 'paused', 'removed']

/** Every track the user was ever enrolled in, with its status (removed ones too). */
export async function readEnrollments(
  supabase: Client,
  userId: string,
): Promise<(Enrollment & { trackId: string })[]> {
  const { data, error } = await supabase
    .from('user_tracks')
    .select('track_id, status, budget_minutes, roadmap_variant, start_date')
    .eq('user_id', userId)
  if (error) throw new Error('Could not read the enrolled tracks', { cause: error })
  return data.map((row) => ({
    trackId: row.track_id,
    // The check constraint allows exactly these; anything else reads as removed (not shown).
    status: STATUSES.find((status) => status === row.status) ?? 'removed',
    budgetMinutes: row.budget_minutes,
    roadmapVariant: row.roadmap_variant,
    startDate: row.start_date,
  }))
}

/** The local day of the user's latest `track.paused` event for `trackId`, or null when none. */
export async function readLastPausedDay(
  supabase: Client,
  userId: string,
  trackId: string,
): Promise<LocalDay | null> {
  const { data, error } = await supabase
    .from('events')
    .select('local_day')
    .eq('user_id', userId)
    .eq('type', 'track.paused')
    .eq('track_id', trackId)
    .order('occurred_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error('Could not read the latest pause', { cause: error })
  return data?.local_day ?? null
}
