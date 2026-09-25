/**
 * The settings forms' inputs and results (§2.4, task 2.11): shared by the forms (types) and the
 * actions (parsing), so both speak the same field names and Vietnamese messages. Client-safe:
 * zod, the pure domain and the strings only.
 */
import { z } from 'zod'
import type { CodeLanguage } from '@/lib/auth/dal'
import type { TrackOption } from '@/lib/content/track-options'
import { isDayStart, isLocalDay } from '@/lib/domain/time/localDay'
import { vi } from '@/lib/i18n/vi'

const errors = vi.onboarding.errors

/** What every settings action returns: a Vietnamese message for the toast or the form. */
export type SettingsResult = {
  ok: boolean
  message: string
  /** Keyed by the form field's `name`. */
  fieldErrors?: Record<string, string>
}

/** A settings server action as a form action (`useActionState`); `null` before the first run. */
export type SettingsAction = (
  previous: SettingsResult | null,
  formData: FormData,
) => Promise<SettingsResult>

export type EnrollmentStatus = 'active' | 'paused' | 'removed'

/** The learner's `user_tracks` row for a track. */
export type Enrollment = {
  status: EnrollmentStatus
  budgetMinutes: number
  roadmapVariant: string
  /** `YYYY-MM-DD`. */
  startDate: string
}

/** An active track and the learner's enrollment in it (`null`: never enrolled). */
export type SettingsTrack = { option: TrackOption; enrollment: Enrollment | null }

export const CODE_LANGUAGES = ['python', 'java', 'go'] as const satisfies readonly CodeLanguage[]

/** Minutes per track: 10–240 in steps of 5 (decision 22). Form values arrive as text. */
const budgetMinutes = z
  .string({ error: errors.minutes })
  .trim()
  .regex(/^\d+$/, errors.minutes)
  .transform(Number)
  .pipe(
    z
      .number()
      .int(errors.minutes)
      .min(10, errors.minutes)
      .max(240, errors.minutes)
      .multipleOf(5, errors.minutes),
  )

/** The typed minutes as a number when they are a valid budget, else null (for live previews). */
export function parseBudgetMinutes(text: string): number | null {
  const parsed = budgetMinutes.safeParse(text)
  return parsed.success ? parsed.data : null
}

const requestId = z.uuid()
/** The database's rule for track ids (`user_tracks.track_id`). */
const trackId = z.string().regex(/^[a-z][a-z0-9-]{0,31}$/)
const roadmapVariant = z.string({ error: errors.variant }).min(1, errors.variant)

export const scheduleInputSchema = z.object({
  requestId,
  timezone: z.string({ error: errors.timezone }).min(1, errors.timezone),
  dayStartsAt: z.string({ error: errors.dayStart }).refine(isDayStart, errors.dayStart),
})

export const codeLanguageInputSchema = z.object({
  requestId,
  codeLanguage: z.enum(CODE_LANGUAGES, { error: errors.codeLanguage }),
})

export const trackInputSchema = z.object({ requestId, trackId, budgetMinutes, roadmapVariant })

export const enrollInputSchema = trackInputSchema.extend({
  startDate: z.string({ error: errors.startDate }).refine(isLocalDay, errors.startDate),
})

export const statusInputSchema = z.object({
  requestId,
  trackId,
  to: z.enum(['paused', 'active', 'removed']),
})

/** The form fields a learner can fix; any other problem (requestId, trackId, …) is a form error. */
const FIELDS: ReadonlySet<string> = new Set([
  'timezone',
  'dayStartsAt',
  'codeLanguage',
  'budgetMinutes',
  'roadmapVariant',
  'startDate',
])

/** The named form fields as an object of strings (missing fields stay `undefined`). */
export function formFields<const K extends string>(
  formData: FormData,
  keys: readonly K[],
): Record<K, string | undefined> {
  const fields = {} as Record<K, string | undefined>
  for (const key of keys) {
    const value = formData.get(key)
    fields[key] = typeof value === 'string' ? value : undefined
  }
  return fields
}

/**
 * A rejected input as a result: one message per field the learner can fix (the first issue wins),
 * or a form error when the problem is not one of those fields.
 */
export function invalidInput(error: z.ZodError): SettingsResult {
  const fieldErrors: Record<string, string> = {}
  for (const issue of error.issues) {
    const [field] = issue.path
    if (typeof field !== 'string' || !FIELDS.has(field)) {
      return { ok: false, message: vi.settings.errors.invalid }
    }
    fieldErrors[field] ??= issue.message
  }
  return { ok: false, message: vi.settings.errors.fields, fieldErrors }
}

/** One field's error, with the form-level hint to look below. */
export const fieldError = (field: string, message: string): SettingsResult => ({
  ok: false,
  message: vi.settings.errors.fields,
  fieldErrors: { [field]: message },
})
