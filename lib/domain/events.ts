import { z } from 'zod'
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
 * Types only the server writes (`apply_system_event`, secret key). `block.checked_in` is in both
 * lists: the learner's check-in and the system's auto check-in (§5.5).
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
/** The database's rule for `user_tracks.roadmap_variant`. */
const roadmapVariant = z.string().regex(/^[a-z0-9][a-z0-9-]{0,31}$/)
/** Minutes per track: 10–240 in steps of 5 (decision 22). */
const budgetMinutes = z.number().int().min(10).max(240).multipleOf(5)
const nonNegativeInt = z.number().int().min(0)
const planVersion = z.number().int().min(1)
const jsonObject = z.record(z.string(), z.unknown())

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
  'track.resumed': z.strictObject({ pausedDays: nonNegativeInt }),
  'track.removed': emptyPayload,
  'track.reset': emptyPayload,
  'schedule.changed': z.strictObject({
    timezone: z.string().min(1),
    dayStartsAt: dayStart,
    effectiveAt: z.iso.datetime({ offset: true }),
  }),
  'settings.changed': z
    .strictObject({
      codeLanguage: z.enum(['python', 'java', 'go']).optional(),
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
  // Reserved: written only by the future compaction job (§4.7); replay handles it from M4 on.
  'item.snapshot': z.strictObject({
    level: z.number().int(),
    weak: z.boolean(),
    topSuccesses: z.number().int(),
    dueOn: localDay.nullable(),
    lapses: z.number().int(),
    reps: z.number().int(),
    rulesVersion: z.number().int().min(1),
  }),
} satisfies Record<EventType, z.ZodType>

export type EventPayload<T extends EventType> = z.infer<(typeof EVENT_PAYLOADS)[T]>

/**
 * Upper bound on the UTF-8 size of a payload's `JSON.stringify`. The database checks
 * `octet_length(payload::text) <= 2048`, and `jsonb` text adds a space after every `:` and `,`;
 * the margin keeps a payload TypeScript accepts from being rejected there.
 */
export const MAX_PAYLOAD_BYTES = 1900

const utf8 = new TextEncoder()

/**
 * Validates `payload` against the schema for `type` and returns the parsed payload. Throws a
 * `ZodError` when the schema rejects it, or when the UTF-8 size of its JSON exceeds
 * `MAX_PAYLOAD_BYTES`.
 */
export function parseEventPayload<T extends EventType>(type: T, payload: unknown): EventPayload<T> {
  if (!Object.hasOwn(EVENT_PAYLOADS, type)) {
    throw new Error(`Unknown event type: "${type}"`)
  }
  const schema: z.ZodType = EVENT_PAYLOADS[type]
  const parsed = schema.parse(payload) as EventPayload<T>
  const bytes = utf8.encode(JSON.stringify(parsed)).length
  if (bytes > MAX_PAYLOAD_BYTES) {
    throw new z.ZodError([
      {
        code: 'custom',
        path: [],
        input: payload,
        message: `the ${type} payload is ${bytes} bytes of JSON; at most ${MAX_PAYLOAD_BYTES} are allowed`,
      },
    ])
  }
  return parsed
}
