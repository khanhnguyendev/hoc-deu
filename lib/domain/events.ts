import { z } from 'zod'
import { budgetMinutesSchema, CODE_LANGUAGES, ROADMAP_VARIANT_PATTERN } from './settings'
import { isDayStart, isLocalDay } from './time/localDay'

/**
 * Event types and their payload schemas (platform design §4.4) — the source of truth for replay.
 * Every payload schema is strict: an unknown key is an error, never silently dropped.
 */

/** Types a learner may write (`apply_event`); SQL `public.learner_event_types()` mirrors this list. */
export const LEARNER_EVENT_TYPES = [
  'block.checked_in',
  'item.result',
  'lesson.completed',
  'exercise.submitted',
  'prompt.completed',
  'item.skipped',
  'item.readded',
  'track.enrolled',
  'track.updated',
  'track.paused',
  'track.resumed',
  'track.removed',
  'track.reset',
  'schedule.changed',
  'settings.changed',
] as const

/**
 * Types only the server writes (`apply_system_event`, secret key); SQL
 * `public.system_event_types()` mirrors this list. `block.checked_in` is in both lists: the
 * learner's check-in and the system's auto check-in (§5.5).
 */
export const SYSTEM_EVENT_TYPES = [
  'plan.generated',
  'plan.extra_added',
  'onboarding.completed',
  'plan.ai_proposed',
  'plan.ai_applied',
  'plan.ai_skipped',
  'block.checked_in',
  'user_item.created',
  'user_item.retired',
  'user_item.hidden',
  'roadmap.override_set',
  'roadmap.override_revoked',
  'roadmap.override_suspended',
  'roadmap.override_resumed',
  'admin.bot_token_rotated',
  'admin.bootstrapped',
  'admin.user_approved',
  'admin.user_rejected',
  'admin.user_suspended',
  'admin.role_changed',
  'admin.ai_flag_changed',
  'item.snapshot',
] as const

export type LearnerEventType = (typeof LEARNER_EVENT_TYPES)[number]
export type SystemEventType = (typeof SYSTEM_EVENT_TYPES)[number]
export type EventType = LearnerEventType | SystemEventType

const localDay = z.string().refine(isLocalDay, 'not a valid local day (YYYY-MM-DD)')
const dayStart = z.string().refine(isDayStart, 'not a day start (00:00–12:00, 30-minute steps)')
const roadmapVariant = z.string().regex(ROADMAP_VARIANT_PATTERN)
const budgetMinutes = budgetMinutesSchema()
const nonNegativeInt = z.number().int().min(0)
const planVersion = z.number().int().min(1)
const jsonObject = z.record(z.string(), z.unknown())

/**
 * The longest pause `track.resumed` may report, in days (ten years; Part B-M4 decision 36).
 * `apply_event` rejects a larger `pausedDays` too (before casting it), and the settings action
 * clamps to it.
 */
export const MAX_PAUSED_DAYS = 3650

/** A payload whose keys are all optional must still carry a change (`{}` is rejected). */
const hasAKey = (payload: Record<string, unknown>): boolean =>
  Object.values(payload).some((value) => value !== undefined)
const AT_LEAST_ONE_KEY = 'at least one field is required'

const emptyPayload = z.strictObject({})
const aiRunPayload = z.strictObject({
  runId: z.string(),
  outcome: z.string(),
  planVersion: planVersion.optional(),
})
const userItemPayload = z.strictObject({
  itemType: z.enum(['flashcard', 'exercise', 'prompt']),
  slug: z.string().optional(),
})
const overridePayload = z.strictObject({
  key: z.string(),
  kind: z.enum(['insert_block', 'extra_week', 'reorder_topics']),
  params: jsonObject.optional(),
})
const overrideKeysPayload = z.strictObject({ keys: z.array(z.string()) })
const adminPayload = z.strictObject({
  targetUserId: z.uuid().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
})

export const EVENT_PAYLOADS = {
  'block.checked_in': z.strictObject({
    status: z.enum(['done', 'partial', 'skipped']),
    minutes: z.number().int().min(0).max(600),
    // A storage bound only; the 280-grapheme rule for learner notes is task 5.2's.
    note: z.string().max(1000).optional(),
    auto: z.boolean().optional(),
  }),
  'item.result': z.strictObject({
    result: z.enum(['solved', 'hint', 'failed', 'know', 'unsure', 'dont_know']),
    mode: z.enum(['recall', 'redo']).optional(),
  }),
  'lesson.completed': z.strictObject({ quizScore: z.number().int().min(0).max(100).optional() }),
  'exercise.submitted': z.strictObject({
    kind: z.string().min(1),
    grade: z.enum(['pass', 'close', 'miss']),
  }),
  'prompt.completed': z.strictObject({ selfRating: z.literal([1, 2, 3]).optional() }),
  'item.skipped': emptyPayload,
  'item.readded': emptyPayload,
  'track.enrolled': z.strictObject({ roadmapVariant, budgetMinutes, startDate: localDay }),
  'track.updated': z
    .strictObject({
      budgetMinutes: budgetMinutes.optional(),
      roadmapVariant: roadmapVariant.optional(),
      newPerDay: nonNegativeInt.nullable().optional(),
      throttle: z
        .array(z.strictObject({ dueAbove: nonNegativeInt, newPerDay: nonNegativeInt }))
        .nullable()
        .optional(),
      weeklyTemplate: jsonObject.nullable().optional(),
      includeBonus: z.boolean().optional(),
    })
    .refine(hasAKey, AT_LEAST_ONE_KEY),
  'track.paused': emptyPayload,
  'track.resumed': z.strictObject({ pausedDays: nonNegativeInt.max(MAX_PAUSED_DAYS) }),
  'track.removed': emptyPayload,
  'track.reset': emptyPayload,
  'schedule.changed': z.strictObject({
    timezone: z.string().min(1),
    dayStartsAt: dayStart,
    effectiveAt: z.iso.datetime({ offset: true }),
  }),
  'settings.changed': z
    .strictObject({
      codeLanguage: z.enum(CODE_LANGUAGES).optional(),
      shareNotesWithAi: z.boolean().optional(),
      theme: z.enum(['light', 'dark', 'system']).optional(),
    })
    .refine(hasAKey, AT_LEAST_ONE_KEY),
  'plan.generated': z.strictObject({
    mode: z.enum(['baseline', 'resume', 'rebuild']),
    planVersion,
  }),
  'plan.extra_added': z.strictObject({ itemIds: z.array(z.string()).min(1) }),
  'onboarding.completed': emptyPayload,
  'plan.ai_proposed': aiRunPayload,
  'plan.ai_applied': aiRunPayload,
  'plan.ai_skipped': aiRunPayload,
  'user_item.created': userItemPayload,
  'user_item.retired': userItemPayload,
  'user_item.hidden': userItemPayload,
  'roadmap.override_set': overridePayload,
  'roadmap.override_revoked': overridePayload,
  'roadmap.override_suspended': overrideKeysPayload,
  'roadmap.override_resumed': overrideKeysPayload,
  'admin.bot_token_rotated': adminPayload,
  'admin.bootstrapped': adminPayload,
  'admin.user_approved': adminPayload,
  'admin.user_rejected': adminPayload,
  'admin.user_suspended': adminPayload,
  'admin.role_changed': adminPayload,
  'admin.ai_flag_changed': adminPayload,
  // Reserved: written only by the future compaction job (§4.7); replay handles it from M4 on. It
  // carries a full `item_state` row (Part B-M4 decision 19), so a snapshot replaces the results it
  // compacts.
  'item.snapshot': z.strictObject({
    level: z.number().int(),
    weak: z.boolean(),
    topSuccesses: z.number().int(),
    dueOn: localDay.nullable(),
    lapses: z.number().int(),
    reps: z.number().int(),
    introducedOn: localDay,
    lastResult: z.string().max(32).nullable(),
    lastResultOn: localDay.nullable(),
    rulesVersion: z.number().int().min(1),
  }),
} satisfies Record<EventType, z.ZodType>

export type EventPayload<T extends EventType> = z.infer<(typeof EVENT_PAYLOADS)[T]>

/**
 * Upper bound on a payload's size as the database stores it: the UTF-8 bytes of `payload::text`,
 * which `jsonbTextBytes` computes. The database checks `octet_length(payload::text) <= 2048`; the
 * margin covers number formatting (jsonb prints `1e21` as 22 digits), so nothing
 * `parseEventPayload` accepts is rejected there.
 */
export const MAX_PAYLOAD_BYTES = 1900

const utf8 = new TextEncoder()

/** Spaces jsonb's text output adds to JSON: one after each key's `:`, one after each `,`. */
function jsonbSeparatorSpaces(value: unknown): number {
  const entries: unknown[] = Array.isArray(value)
    ? value
    : value !== null && typeof value === 'object'
      ? Object.values(value)
      : []
  const keys = Array.isArray(value) ? 0 : entries.length
  const commas = Math.max(entries.length - 1, 0)
  return entries.reduce<number>((sum, entry) => sum + jsonbSeparatorSpaces(entry), keys + commas)
}

/**
 * The UTF-8 size of `value` as Postgres prints it from `jsonb` (`payload::text`): the bytes of
 * `JSON.stringify(value)` plus the spaces jsonb adds after every `:` and `,`. String escapes and
 * key order do not change the size. `value` must be a JSON-serialisable object or array.
 */
export function jsonbTextBytes(value: unknown): number {
  const json = JSON.stringify(value)
  return utf8.encode(json).length + jsonbSeparatorSpaces(JSON.parse(json))
}

/** jsonb rejects `\u0000` and unpaired surrogates in any string, key or value. */
function hasUnstorableString(value: unknown): boolean {
  if (typeof value === 'string') return value.includes('\u0000') || !value.isWellFormed()
  if (Array.isArray(value)) return value.some(hasUnstorableString)
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).some(
      ([key, entry]) => hasUnstorableString(key) || hasUnstorableString(entry),
    )
  }
  return false
}

const payloadError = (payload: unknown, message: string): z.ZodError =>
  new z.ZodError([{ code: 'custom', path: [], input: payload, message }])

/**
 * Validates `payload` against the schema for `type` and returns the parsed payload. Throws a
 * `ZodError` when the schema rejects it, when a string holds `\u0000` or an unpaired surrogate
 * (jsonb cannot store them), when JSON cannot serialise it (a BigInt in a free-form object), or
 * when its jsonb text (`jsonbTextBytes`) exceeds `MAX_PAYLOAD_BYTES` — so nothing it accepts is
 * rejected by the database.
 */
export function parseEventPayload<T extends EventType>(type: T, payload: unknown): EventPayload<T> {
  if (!Object.hasOwn(EVENT_PAYLOADS, type)) {
    throw new Error(`Unknown event type: "${type}"`)
  }
  const schema: z.ZodType = EVENT_PAYLOADS[type]
  const parsed = schema.parse(payload) as EventPayload<T>
  if (hasUnstorableString(parsed)) {
    throw payloadError(
      payload,
      `the ${type} payload has a string with U+0000 or an unpaired surrogate, which jsonb cannot store`,
    )
  }
  let bytes: number
  try {
    bytes = jsonbTextBytes(parsed)
  } catch (error) {
    // `JSON.stringify` throws a TypeError for a BigInt, which a free-form `z.unknown()` accepts.
    if (!(error instanceof TypeError)) throw error
    throw payloadError(payload, `the ${type} payload is not JSON-serialisable`)
  }
  if (bytes > MAX_PAYLOAD_BYTES) {
    throw payloadError(
      payload,
      `the ${type} payload is ${bytes} bytes as jsonb text; at most ${MAX_PAYLOAD_BYTES} are allowed`,
    )
  }
  return parsed
}
