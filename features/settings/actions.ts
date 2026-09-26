'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireOnboarded, requireUser } from '@/lib/auth/dal'
import { activeTracks, getTrack } from '@/lib/content/tracks'
import { MAX_PAUSED_DAYS } from '@/lib/domain/events'
import { MAX_START_DAYS_AHEAD } from '@/lib/domain/settings'
import {
  daysBetween,
  localDay,
  nextDayStart,
  type Schedule,
  type ScheduleVersion,
} from '@/lib/domain/time/localDay'
import { canonicalTimeZone, isTimeZoneOption } from '@/lib/domain/time/timeZones'
import { applyLearnerEvent, EventError } from '@/lib/events/apply'
import { deriveEventId, digest } from '@/lib/events/ids'
import { withTitle } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'
import { rebuildTodayIfUntouched } from '@/lib/plans/rebuild'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { readEnrollments, readLastPausedDay, readScheduleVersions } from './reads'
import { pendingNotice, sameSchedule, scheduleState } from './schedule'
import {
  codeLanguageInputSchema,
  enrollInputSchema,
  fieldError,
  formFields,
  invalidInput,
  scheduleInputSchema,
  statusInputSchema,
  trackInputSchema,
  type SettingsResult,
} from './schema'

const copy = vi.settings
const errors = vi.onboarding.errors
const PATH = '/settings'

/**
 * The account's tracks or schedules changed since the page was rendered (another tab, a day start
 * that passed): re-render it, so it shows the current state (ruling R17 adds the schedule codes).
 */
const STALE: ReadonlySet<EventError['code']> = new Set([
  'invalid_transition',
  'track_not_enrolled',
  'too_many_pending_schedules',
  'schedule_in_force',
  'schedule_backdated',
])

const titleOf = (trackId: string) => getTrack(trackId)?.title.vi ?? trackId

const stale = (message: string = vi.errors.invalidTransition): SettingsResult => {
  revalidatePath(PATH)
  return { ok: false, message }
}

/**
 * Records one event, then re-renders `/settings` — which also brings a fresh `requestId`, so the
 * next change is a new event (decision 9). An `EventError` becomes its Vietnamese message; any
 * other error goes to the route's error boundary. With `rebuildFor` (a track change: budget,
 * variant, add, pause, resume, remove), a recorded event is followed by
 * `rebuildTodayIfUntouched` (Part B-M5 decision 11): today's plan follows the change while it is
 * untouched, otherwise the change applies from tomorrow — its outcome never changes the message.
 */
async function record(
  apply: () => Promise<unknown>,
  message: string,
  rebuildFor?: string,
): Promise<SettingsResult> {
  try {
    await apply()
  } catch (error) {
    if (!(error instanceof EventError)) throw error
    if (error.code === 'invalid_timezone') return fieldError('timezone', errors.timezone)
    if (STALE.has(error.code)) return stale(error.userMessage)
    return { ok: false, message: error.userMessage }
  }
  if (rebuildFor !== undefined) await rebuildToday(rebuildFor)
  revalidatePath(PATH)
  return { ok: true, message }
}

/**
 * `rebuildTodayIfUntouched` after a recorded change. The change is saved whatever happens here:
 * a failure (e.g. a read that failed) is logged — its name and message only, never user data —
 * and today's plan stays as it is (the change applies from tomorrow), so the learner still sees
 * the success message and the re-rendered page.
 */
async function rebuildToday(userId: string): Promise<void> {
  try {
    await rebuildTodayIfUntouched(userId)
  } catch (error) {
    console.error(
      '[settings] rebuild failed:',
      error instanceof Error ? `${error.name}: ${error.message}` : typeof error,
    )
  }
}

/** The learner's today, in the schedule in force (§5.1). */
function today(versions: readonly ScheduleVersion[], now: Date): string {
  return localDay(now, scheduleState(versions, now).schedule)
}

/**
 * Time zone and day start (§5.9). A change takes effect at the next day start of the schedule in
 * force, so the day being studied is never rewritten; while a change is pending, every new
 * change — also switching back to the schedule in force — targets the pending version's
 * `effectiveAt` and replaces it (upsert, 2.5b). Values equal to the pending change (or, with none
 * pending, the schedule in force) send nothing.
 */
export async function updateSchedule(
  _previous: SettingsResult | null,
  formData: FormData,
): Promise<SettingsResult> {
  const user = await requireOnboarded()
  const parsed = scheduleInputSchema.safeParse(
    formFields(formData, ['requestId', 'timezone', 'dayStartsAt']),
  )
  if (!parsed.success) return invalidInput(parsed.error)
  const timezone = canonicalTimeZone(parsed.data.timezone)
  if (!isTimeZoneOption(timezone)) return fieldError('timezone', errors.timezone)
  const desired: Schedule = { timezone, dayStartsAt: parsed.data.dayStartsAt }

  const supabase = await createClient()
  const now = new Date()
  const { schedule, pending } = scheduleState(await readScheduleVersions(supabase, user.id), now)
  const changePending = pending !== null && !sameSchedule(pending, schedule)
  if (sameSchedule(desired, changePending ? pending : schedule)) {
    return { ok: true, message: copy.schedule.unchanged }
  }

  const effectiveAt = pending?.effectiveAt ?? nextDayStart(now, schedule).toISOString()
  return record(
    () =>
      applyLearnerEvent(supabase, {
        // Digested on `desired` only, never `effectiveAt` (server-derived): an edited resubmit —
        // a different zone, picked after reading the first error — must send a new event, but the
        // same tap twice must still collapse to one (M2 RF-2 "digest keys" minor; decision 16).
        id: deriveEventId(parsed.data.requestId, `schedule.changed:${digest(desired)}`),
        type: 'schedule.changed',
        payload: { ...desired, effectiveAt },
      }),
    sameSchedule(desired, schedule)
      ? copy.schedule.cancelled
      : pendingNotice(effectiveAt, schedule.timezone),
  )
}

/** The code language for solutions (§2.4); a profile without one reads as Python. */
export async function updateCodeLanguage(
  _previous: SettingsResult | null,
  formData: FormData,
): Promise<SettingsResult> {
  const user = await requireOnboarded()
  const parsed = codeLanguageInputSchema.safeParse(
    formFields(formData, ['requestId', 'codeLanguage']),
  )
  if (!parsed.success) return invalidInput(parsed.error)
  const { requestId, codeLanguage } = parsed.data
  if ((user.codeLanguage ?? 'python') === codeLanguage) {
    return { ok: true, message: copy.codeLanguage.unchanged }
  }

  const supabase = await createClient()
  return record(
    () =>
      applyLearnerEvent(supabase, {
        id: deriveEventId(requestId, `settings.changed:${digest({ codeLanguage })}`),
        type: 'settings.changed',
        payload: { codeLanguage },
      }),
    copy.codeLanguage.saved,
  )
}

/**
 * Minutes per day and the roadmap variant of an enrolled (active or paused) track: `track.updated`
 * with only the keys that changed (§4.4); nothing when neither did.
 */
export async function updateTrack(
  _previous: SettingsResult | null,
  formData: FormData,
): Promise<SettingsResult> {
  const user = await requireOnboarded()
  const parsed = trackInputSchema.safeParse(
    formFields(formData, ['requestId', 'trackId', 'budgetMinutes', 'roadmapVariant']),
  )
  if (!parsed.success) return invalidInput(parsed.error)
  const { requestId, trackId, budgetMinutes, roadmapVariant } = parsed.data
  const track = activeTracks().find((candidate) => candidate.id === trackId)
  if (track === undefined) return { ok: false, message: errors.unknownTrack }
  if (!track.roadmaps.some((roadmap) => roadmap.id === roadmapVariant)) {
    return fieldError('roadmapVariant', errors.variant)
  }

  const supabase = await createClient()
  const enrollment = (await readEnrollments(supabase, user.id)).find(
    (row) => row.trackId === trackId,
  )
  if (enrollment === undefined || enrollment.status === 'removed') return stale()

  const changes = {
    ...(budgetMinutes === enrollment.budgetMinutes ? {} : { budgetMinutes }),
    ...(roadmapVariant === enrollment.roadmapVariant ? {} : { roadmapVariant }),
  }
  if (Object.keys(changes).length === 0) return { ok: true, message: copy.tracks.unchanged }

  return record(
    () =>
      applyLearnerEvent(supabase, {
        id: deriveEventId(requestId, `track.updated:${trackId}:${digest(changes)}`),
        type: 'track.updated',
        trackId,
        payload: changes,
      }),
    withTitle(copy.tracks.updated, track.title.vi),
    user.id,
  )
}

/**
 * "Thêm lộ trình": enrolls an active track the learner never had or removed. Re-adding a removed
 * track keeps its history (§5.9). A past start date becomes today; a future one may be at most
 * 60 days ahead (decision 22).
 */
export async function enrollTrack(
  _previous: SettingsResult | null,
  formData: FormData,
): Promise<SettingsResult> {
  const user = await requireOnboarded()
  const parsed = enrollInputSchema.safeParse(
    formFields(formData, ['requestId', 'trackId', 'budgetMinutes', 'roadmapVariant', 'startDate']),
  )
  if (!parsed.success) return invalidInput(parsed.error)
  const { requestId, trackId, budgetMinutes, roadmapVariant } = parsed.data
  const track = activeTracks().find((candidate) => candidate.id === trackId)
  if (track === undefined) return { ok: false, message: errors.unknownTrack }
  if (!track.roadmaps.some((roadmap) => roadmap.id === roadmapVariant)) {
    return fieldError('roadmapVariant', errors.variant)
  }

  const supabase = await createClient()
  const now = new Date()
  const [versions, enrollments] = await Promise.all([
    readScheduleVersions(supabase, user.id),
    readEnrollments(supabase, user.id),
  ])
  const enrollment = enrollments.find((row) => row.trackId === trackId)
  if (enrollment !== undefined && enrollment.status !== 'removed') {
    return stale(copy.errors.alreadyEnrolled)
  }
  const day = today(versions, now)
  const startDate = daysBetween(day, parsed.data.startDate) < 0 ? day : parsed.data.startDate
  if (daysBetween(day, startDate) > MAX_START_DAYS_AHEAD) {
    return fieldError('startDate', errors.startDateTooLate)
  }

  return record(
    () =>
      applyLearnerEvent(supabase, {
        id: deriveEventId(
          requestId,
          `track.enrolled:${trackId}:${digest({ roadmapVariant, budgetMinutes, startDate })}`,
        ),
        type: 'track.enrolled',
        trackId,
        payload: { roadmapVariant, budgetMinutes, startDate },
      }),
    withTitle(copy.add.added, track.title.vi),
    user.id,
  )
}

/**
 * Pause, resume or remove a track (§5.9, decision 18); the database checks the transition. A
 * resume sends `pausedDays`: the days from the latest `track.paused` event's local day to today,
 * so the track's due dates shift forward by the pause — at most `MAX_PAUSED_DAYS` (Part B-M4
 * decision 36), which is all the database accepts.
 */
export async function setTrackStatus(
  _previous: SettingsResult | null,
  formData: FormData,
): Promise<SettingsResult> {
  const user = await requireOnboarded()
  const parsed = statusInputSchema.safeParse(formFields(formData, ['requestId', 'trackId', 'to']))
  if (!parsed.success) return invalidInput(parsed.error)
  const { requestId, trackId, to } = parsed.data
  const title = titleOf(trackId)
  const supabase = await createClient()

  if (to === 'paused') {
    return record(
      () =>
        applyLearnerEvent(supabase, {
          id: deriveEventId(requestId, `track.paused:${trackId}`),
          type: 'track.paused',
          trackId,
          payload: {},
        }),
      withTitle(copy.tracks.paused, title),
      user.id,
    )
  }
  if (to === 'removed') {
    return record(
      () =>
        applyLearnerEvent(supabase, {
          id: deriveEventId(requestId, `track.removed:${trackId}`),
          type: 'track.removed',
          trackId,
          payload: {},
        }),
      withTitle(copy.tracks.removed, title),
      user.id,
    )
  }

  const now = new Date()
  const [versions, pausedOn] = await Promise.all([
    readScheduleVersions(supabase, user.id),
    readLastPausedDay(supabase, user.id, trackId),
  ])
  const pausedDays =
    pausedOn === null
      ? 0
      : Math.min(MAX_PAUSED_DAYS, Math.max(0, daysBetween(pausedOn, today(versions, now))))
  return record(
    () =>
      applyLearnerEvent(supabase, {
        id: deriveEventId(requestId, `track.resumed:${trackId}`),
        type: 'track.resumed',
        trackId,
        payload: { pausedDays },
      }),
    withTitle(copy.tracks.resumed, title),
    user.id,
  )
}

/**
 * "Xoá tài khoản" (§4.6): deletes the `auth.users` row through the admin API, which cascades to
 * every one of the account's own rows (the database enforces this — the cascade also removes
 * tables that do not exist yet, such as `bot_run_users`). Guarded by `requireUser`, not
 * `requireOnboarded`: a pending, rejected or suspended account may delete itself too, from a
 * later entry point (§4.6). On success, signs out locally (cookies only — the user no longer
 * exists to revoke a session for) and returns to the landing page with the deleted notice.
 * `redirect()` is the function's last statement, outside any try/catch (it works by throwing).
 * Takes no arguments (assignable to `SettingsAction`: fewer parameters is fine) — there is no
 * form data to read. The local sign-out's error is ignored entirely — a returned `{ error }` or a
 * rejection — and never blocks the redirect (controller ruling, M2 minor): the account row is
 * already gone by then, so a thrown error here would be misleading (the learner would see a
 * failure for a delete that actually went through), and auth-js has already cleared the session
 * client-side for most error cases regardless.
 */
export async function deleteAccount(): Promise<SettingsResult> {
  const user = await requireUser()
  const { error } = await createAdminClient().auth.admin.deleteUser(user.id)
  if (error) return { ok: false, message: copy.deleteAccount.failed }

  const supabase = await createClient()
  try {
    await supabase.auth.signOut({ scope: 'local' })
  } catch {
    // Ignored either way (a returned `{ error }` or a rejection): see the doc comment above.
  }
  redirect('/?account=deleted')
}
