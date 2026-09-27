'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { requireActive } from '@/lib/auth/dal'
import { activeTracks } from '@/lib/content/tracks'
import { MAX_START_DAYS_AHEAD } from '@/lib/domain/settings'
import { daysBetween, localDay, type Schedule } from '@/lib/domain/time/localDay'
import { canonicalTimeZone, isTimeZoneOption } from '@/lib/domain/time/timeZones'
import { applyLearnerEvent, applySystemEvent, EventError } from '@/lib/events/apply'
import { deriveEventId } from '@/lib/events/ids'
import { vi } from '@/lib/i18n/vi'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Database } from '@/lib/supabase/database.types'
import { createClient } from '@/lib/supabase/server'
import { scheduleKey, settingsKey, trackEnrolledKey, trackRemovedKey } from './event-keys'
import {
  onboardingFieldErrors,
  onboardingInputSchema,
  trackFieldKey,
  type OnboardingInput,
  type OnboardingState,
} from './schema'

const errors = vi.onboarding.errors

/**
 * The first schedule takes effect this long before the server's `now` (decision 5). The database
 * files each event under the `local_day` of its own `now()`; were this server's clock slightly
 * ahead, a schedule "from now" would not be in force yet there, and the onboarding events would
 * land on the default schedule's day. The first version may lie in the past (no past day exists).
 */
const FIRST_SCHEDULE_LEAD_MS = 60_000

const failed = (
  fieldErrors: Record<string, string>,
  formError: string | null = null,
): OnboardingState => ({ status: 'error', formError, fieldErrors })

/** The payload field as JSON, or `undefined` when it is missing or not JSON. */
function readPayload(formData: FormData): unknown {
  const raw = formData.get('payload')
  if (typeof raw !== 'string') return undefined
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return undefined
  }
}

type Checked = { input: OnboardingInput; schedule: Schedule; startDate: string }

/**
 * What the schema cannot know: every track is active, each variant is one of its roadmaps, the
 * code language is required exactly when a selected track uses one, the time zone is one the
 * picker offers (canonicalised, decision 6; ruling R17), and the start date is at most 60 days
 * ahead — a past one becomes today, in the learner's own schedule (decision 22).
 */
function check(input: OnboardingInput, now: Date): Checked | Record<string, string> {
  const fieldErrors: Record<string, string> = {}
  const tracks = activeTracks()
  const languages = new Set<string>()
  for (const { trackId, roadmapVariant } of input.tracks) {
    const track = tracks.find((candidate) => candidate.id === trackId)
    if (track === undefined) {
      fieldErrors.tracks ??= errors.unknownTrack
      continue
    }
    if (!track.roadmaps.some((roadmap) => roadmap.id === roadmapVariant)) {
      fieldErrors[trackFieldKey(trackId, 'roadmapVariant')] = errors.variant
    }
    for (const language of track.codeLanguages ?? []) languages.add(language)
  }
  if (languages.size === 0 && input.codeLanguage !== undefined) {
    fieldErrors.codeLanguage = errors.codeLanguageUnused
  } else if (
    languages.size > 0 &&
    (input.codeLanguage === undefined || !languages.has(input.codeLanguage))
  ) {
    fieldErrors.codeLanguage = errors.codeLanguage
  }

  const timezone = canonicalTimeZone(input.timezone)
  if (!isTimeZoneOption(timezone)) {
    fieldErrors.timezone = errors.timezone
    return fieldErrors
  }
  const schedule: Schedule = { timezone, dayStartsAt: input.dayStartsAt }
  const today = localDay(now, schedule)
  const startDate = daysBetween(today, input.startDate) < 0 ? today : input.startDate
  if (daysBetween(today, startDate) > MAX_START_DAYS_AHEAD) {
    fieldErrors.startDate = errors.startDateTooLate
  }
  if (Object.keys(fieldErrors).length > 0) return fieldErrors
  return { input, schedule, startDate }
}

const isChecked = (value: Checked | Record<string, string>): value is Checked => 'schedule' in value

type EnrollmentStatus = 'active' | 'paused' | 'removed'
const ENROLLMENT_STATUSES: readonly EnrollmentStatus[] = ['active', 'paused', 'removed']

/** The user's currently `active` enrollments (own row, RLS): candidates for the orphan cleanup below. */
async function activeEnrollmentIds(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from('user_tracks')
    .select('track_id')
    .eq('user_id', userId)
    .eq('status', 'active')
  if (error) throw new Error('Could not read the enrolled tracks', { cause: error })
  return data.map((row) => row.track_id)
}

/**
 * The current status (own row, RLS) of each of `trackIds` — needed only to key `track.enrolled`:
 * a track re-selected after an earlier `track.removed` in this same render (the orphan cleanup
 * below, on a prior submission attempt) must not digest identically to its first enrollment, or
 * `apply_event` reads the resubmit as a no-op `duplicate` and the row stays `removed` (M2 minor,
 * an A→B→A selection within one render). `null` for a track never enrolled.
 */
async function currentStatusesOf(
  supabase: SupabaseClient<Database>,
  userId: string,
  trackIds: string[],
): Promise<Map<string, EnrollmentStatus>> {
  if (trackIds.length === 0) return new Map()
  const { data, error } = await supabase
    .from('user_tracks')
    .select('track_id, status')
    .eq('user_id', userId)
    .in('track_id', trackIds)
  if (error) throw new Error('Could not read the enrolled tracks', { cause: error })
  return new Map(
    data.map((row) => [
      row.track_id,
      // The check constraint allows exactly these; anything else reads as removed (not active).
      ENROLLMENT_STATUSES.find((status) => status === row.status) ?? 'removed',
    ]),
  )
}

/**
 * Finishes onboarding (§2.4) with events, in this order, each id derived from the page's
 * `requestId` (decision 9) and a digest of the fields it carries — never only the track id — so
 * an edited resubmit after a partial failure sends a new event instead of replaying the first
 * submission's values (M2 RF-2 "digest keys" minor): `schedule.changed` (in force from a minute
 * before `now`, decision 5) → `settings.changed` with the code language (when there is one) →
 * `track.enrolled` per track → `track.removed` for every active enrollment the final selection no
 * longer contains — a partial failure, a reload and a different selection must leave no orphan
 * (M2 minor) → `onboarding.completed` (system event, sets `onboarded_at`) → `/today`. A retry that
 * changes nothing sends the very same ids, so the steps that already happened come back
 * `duplicate` (RF-2).
 */
export async function completeOnboarding(
  _previous: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const user = await requireActive()
  if (user.onboardedAt) redirect('/today')

  const payload = readPayload(formData)
  if (payload === undefined) return failed({}, errors.invalid)
  const parsed = onboardingInputSchema.safeParse(payload)
  if (!parsed.success) {
    const { formError, fieldErrors } = onboardingFieldErrors(parsed.error, payload)
    return failed(fieldErrors, formError)
  }

  const now = new Date()
  const checked = check(parsed.data, now)
  if (!isChecked(checked)) return failed(checked)
  const { input, schedule, startDate } = checked
  const eventId = (key: string) => deriveEventId(input.requestId, key)

  try {
    const supabase = await createClient()
    await applyLearnerEvent(supabase, {
      id: eventId(scheduleKey(schedule)),
      type: 'schedule.changed',
      payload: {
        ...schedule,
        effectiveAt: new Date(now.getTime() - FIRST_SCHEDULE_LEAD_MS).toISOString(),
      },
    })
    if (input.codeLanguage !== undefined) {
      await applyLearnerEvent(supabase, {
        id: eventId(settingsKey(input.codeLanguage)),
        type: 'settings.changed',
        payload: { codeLanguage: input.codeLanguage },
      })
    }
    const selectedTrackIds = new Set(input.tracks.map((track) => track.trackId))
    const currentStatuses = await currentStatusesOf(supabase, user.id, [...selectedTrackIds])
    for (const { trackId, roadmapVariant, budgetMinutes } of input.tracks) {
      const currentStatus = currentStatuses.get(trackId) ?? null
      await applyLearnerEvent(supabase, {
        id: eventId(
          trackEnrolledKey(trackId, { roadmapVariant, budgetMinutes, startDate, currentStatus }),
        ),
        type: 'track.enrolled',
        trackId,
        payload: { roadmapVariant, budgetMinutes, startDate },
      })
    }
    const orphanTrackIds = (await activeEnrollmentIds(supabase, user.id)).filter(
      (trackId) => !selectedTrackIds.has(trackId),
    )
    for (const trackId of orphanTrackIds) {
      await applyLearnerEvent(supabase, {
        id: eventId(trackRemovedKey(trackId)),
        type: 'track.removed',
        trackId,
        payload: {},
      })
    }
    await applySystemEvent(createAdminClient(), user.id, {
      id: eventId('onboarding.completed'),
      type: 'onboarding.completed',
      payload: {},
    })
  } catch (error) {
    if (!(error instanceof EventError)) throw error
    if (error.code === 'invalid_timezone') return failed({ timezone: errors.timezone })
    return failed({}, error.userMessage)
  }

  redirect('/today')
}
