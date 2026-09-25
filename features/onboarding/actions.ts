'use server'

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
import { createClient } from '@/lib/supabase/server'
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

/**
 * Finishes onboarding (§2.4) with events, in this order, each id derived from the page's
 * `requestId` (decision 9): `schedule.changed` (in force from a minute before `now`, decision 5) →
 * `settings.changed` with the code language (when there is one) → `track.enrolled` per track →
 * `onboarding.completed` (system event, sets `onboarded_at`) → `/today`. A retry after a partial
 * failure sends the same ids, so the steps that already happened come back `duplicate` (RF-2).
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
      id: eventId('schedule.changed'),
      type: 'schedule.changed',
      payload: {
        ...schedule,
        effectiveAt: new Date(now.getTime() - FIRST_SCHEDULE_LEAD_MS).toISOString(),
      },
    })
    if (input.codeLanguage !== undefined) {
      await applyLearnerEvent(supabase, {
        id: eventId('settings.changed'),
        type: 'settings.changed',
        payload: { codeLanguage: input.codeLanguage },
      })
    }
    for (const { trackId, roadmapVariant, budgetMinutes } of input.tracks) {
      await applyLearnerEvent(supabase, {
        id: eventId(`track.enrolled:${trackId}`),
        type: 'track.enrolled',
        trackId,
        payload: { roadmapVariant, budgetMinutes, startDate },
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
