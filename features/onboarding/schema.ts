/**
 * The onboarding wizard's input (§2.4, task 2.10): what the hidden `payload` field carries to
 * `completeOnboarding`. Shared by the wizard (per-step checks) and the action, so both speak the
 * same field keys and Vietnamese messages. Client-safe: zod, the pure domain and the strings only.
 */
import { z } from 'zod'
import { isDayStart, isLocalDay } from '@/lib/domain/time/localDay'
import { vi } from '@/lib/i18n/vi'

const errors = vi.onboarding.errors

/** Minutes per track: 10–240 in steps of 5 (decision 22). */
const budgetMinutesSchema = z
  .number({ error: errors.minutes })
  .int(errors.minutes)
  .min(10, errors.minutes)
  .max(240, errors.minutes)
  .multipleOf(5, errors.minutes)

export const isBudgetMinutes = (minutes: number): boolean =>
  budgetMinutesSchema.safeParse(minutes).success

const trackInputSchema = z
  .object({
    trackId: z.string().min(1),
    budgetMinutes: budgetMinutesSchema,
    roadmapVariant: z.string({ error: errors.variant }).min(1, errors.variant),
  })
  .strict()

const hasUniqueTrackIds = (tracks: readonly { trackId: string }[]) =>
  new Set(tracks.map((track) => track.trackId)).size === tracks.length

export const onboardingInputSchema = z
  .object({
    requestId: z.uuid(),
    tracks: z
      .array(trackInputSchema, { error: errors.noTrack })
      .min(1, errors.noTrack)
      .refine(hasUniqueTrackIds, errors.duplicateTrack),
    startDate: z.string({ error: errors.startDate }).refine(isLocalDay, errors.startDate),
    timezone: z.string({ error: errors.timezone }).min(1, errors.timezone),
    dayStartsAt: z.string({ error: errors.dayStart }).refine(isDayStart, errors.dayStart),
    codeLanguage: z.enum(['python', 'java', 'go'], { error: errors.codeLanguage }).optional(),
  })
  .strict()

export type OnboardingInput = z.infer<typeof onboardingInputSchema>

export type OnboardingState =
  | { status: 'idle' }
  | { status: 'error'; formError: string | null; fieldErrors: Record<string, string> }

/** The schedule and language fields; track fields are keyed with `trackFieldKey`. */
export type OnboardingField = 'tracks' | 'startDate' | 'timezone' | 'dayStartsAt' | 'codeLanguage'

/** `tracks.<trackId>.<field>` — a track's field, keyed by the track, not its position. */
export const trackFieldKey = (trackId: string, field: 'budgetMinutes' | 'roadmapVariant') =>
  `tracks.${trackId}.${field}`

const TOP_LEVEL_FIELDS: ReadonlySet<string> = new Set<OnboardingField>([
  'tracks',
  'startDate',
  'timezone',
  'dayStartsAt',
  'codeLanguage',
])

/** The track id at `tracks[index]` of the raw input, when it has one. */
function trackIdAt(input: unknown, index: PropertyKey | undefined): string | null {
  if (typeof index !== 'number' || input === null || typeof input !== 'object') return null
  const tracks: unknown = (input as { tracks?: unknown }).tracks
  const track: unknown = Array.isArray(tracks) ? tracks[index] : undefined
  const trackId: unknown =
    track !== null && typeof track === 'object' ? (track as { trackId?: unknown }).trackId : null
  return typeof trackId === 'string' && trackId !== '' ? trackId : null
}

/** The field key an issue belongs to, or null for a form-level problem. */
function fieldKeyOf(issue: z.ZodError['issues'][number], input: unknown): string | null {
  if (issue.code === 'unrecognized_keys') return null
  const [first, index, field] = issue.path
  if (typeof first !== 'string' || !TOP_LEVEL_FIELDS.has(first)) return null
  if (first !== 'tracks' || index === undefined) return first
  const trackId = trackIdAt(input, index)
  if (trackId === null || (field !== 'budgetMinutes' && field !== 'roadmapVariant')) return null
  return trackFieldKey(trackId, field)
}

/**
 * The schema's issues as the wizard shows them: one Vietnamese message per field key (the first
 * issue wins), and a form error for anything that is not a field the learner can fix — a bad
 * request id, an unknown key, a track without an id, or a payload that is not an object at all.
 */
export function onboardingFieldErrors(
  error: z.ZodError,
  input: unknown,
): { formError: string | null; fieldErrors: Record<string, string> } {
  const fieldErrors: Record<string, string> = {}
  let formError: string | null = null
  for (const issue of error.issues) {
    const key = fieldKeyOf(issue, input)
    if (key === null) formError = errors.invalid
    else fieldErrors[key] ??= issue.message
  }
  return formError === null ? { formError, fieldErrors } : { formError, fieldErrors: {} }
}
