/**
 * The `context` contract of the bot API (§6.4.2; §6.3; Part B-M6 decisions 3, 9, 15, 32, 37; task
 * 6.4b): `GET /runs/{runId}/users/{userRef}/context` — one learner's day, pseudonymised and
 * allow-listed. Every object is strict: the server parses its own answer with `contextResponse`
 * before sending it, so a field outside this file never leaves it. No name, e-mail, avatar, user
 * id, `bot_ref` (custom item IDs contain it — accepted, §6.3), event or plan id, nor another
 * learner's data. The only learner text is `untrusted.notes`, sanitised, and only when the learner
 * shares notes. Imports only `zod` and `lib/domain` (decision 3).
 */
import { z } from 'zod'
import { isLocalDay } from '@/lib/domain/time/localDay'
import { BLOCK_KINDS, planBlockSchema } from '@/lib/domain/plan/types'
import { ITEM_STATE_STATUSES } from '@/lib/domain/state'

/** §6.4.2's bounds. */
export const CONTEXT_LIMITS = {
  /** Due items, in due-queue order. */
  due: 50,
  /** New-queue items per track. */
  newQueueHeadPerTrack: 10,
  /** Local days of `recent.days`, today included. */
  recentDays: 14,
  /** The latest `item.result` events. */
  recentResults: 30,
  /** Shared notes (decision 32). */
  notes: 5,
  /** §6.4.3 rule 6. */
  rationaleMaxChars: 280,
} as const

/** §5.4 invariant, as §6.4.2 words it. */
export const MAX_PLANNED_MINUTES_RULE = 'budget, or budget + the single largest item'

const day = z.string().refine(isLocalDay, 'a local day YYYY-MM-DD')
const id = z.string().min(1).max(128)
const minutes = z.number().min(0)
const count = z.number().int().min(0)
const difficulty = z.enum(['E', 'M', 'H']).nullable()

/** A block of the day's template (§5.4 step 1, `fromWeek` already applied). 6.6c adds the day's
 *  `insert_block`s as practice blocks with their `topicId`. */
const templateBlock = z.strictObject({
  kind: z.enum(['review', 'new', 'recap', 'practice']),
  maxMinutes: minutes.optional(),
  minutes: minutes.optional(),
  count: count.optional(),
  tag: z.string().optional(),
  itemType: z.string().optional(),
  topicId: z.string().optional(),
})

const track = z.strictObject({
  trackId: z.string(),
  roadmapVariant: z.string(),
  roadmapWeek: z.number().int().positive(),
  budgetMinutes: minutes,
  templateToday: z.array(templateBlock),
  /** The new-item cap after the throttle (§5.5); null = no cap. */
  effectiveNewPerDay: count.nullable(),
  /** `due_above_<n>` when the throttle lowered the cap. */
  throttleReason: z
    .string()
    .regex(/^due_above_\d+$/)
    .nullable(),
  /** Not-started topics a `reorder_topics` may permute (§5.12); empty when a reorder would move
   *  nothing (core items only in decks, e.g. English). */
  upcomingTopics: z.array(z.string()),
})

const dueItem = z.strictObject({
  itemId: id,
  type: z.string(),
  topic: z.string().nullable(),
  difficulty,
  level: count,
  weak: z.boolean(),
  daysOverdue: count,
})

const newItem = z.strictObject({
  itemId: id,
  type: z.string(),
  topic: z.string().nullable(),
  difficulty,
  /** The item's `new` minutes (§5.4 estimates). */
  estMinutes: minutes,
})

const customItem = z.strictObject({
  itemId: id,
  type: z.enum(['flashcard', 'exercise', 'prompt']),
  topic: z.string(),
  status: z.enum(['active', 'hidden', 'retired']),
  /** `item_state.status`; null while never studied. */
  srsStatus: z.enum(ITEM_STATE_STATUSES).nullable(),
  createdOn: day,
})

/** An active override with its computed expiry (§5.12, decision 18; filled by 6.6c). */
const override = z.strictObject({
  trackId: z.string(),
  key: z.string(),
  kind: z.enum(['insert_block', 'extra_week', 'reorder_topics']),
  /** `insert_block`: the last local day it applies. */
  until: day.optional(),
  /** `extra_week`: the study days left. */
  studyDaysLeft: count.optional(),
})

const recentDay = z.strictObject({
  localDay: day,
  completed: z.boolean(),
  minutesByTrack: z.record(z.string(), minutes),
})

const recentResult = z.strictObject({
  itemId: id,
  result: z.enum(['solved', 'hint', 'failed', 'know', 'unsure', 'dont_know']),
  mode: z.enum(['recall', 'redo']).nullable(),
  localDay: day,
})

const note = z.strictObject({
  localDay: day,
  blockKind: z.enum(BLOCK_KINDS),
  /** Sanitised (decision 32): ≤ 280 graphemes, so at most a few thousand UTF-16 units. */
  text: z.string().min(1).max(4096),
})

const schema = z.strictObject({
  /** The learner's local day now: the plan write's `targetDate`. */
  targetDate: day,
  /** `closed` while the gate is closed, and on a day resumed from a paused plan (decision 9). */
  gate: z.enum(['open', 'closed']),
  existingPlan: z
    .strictObject({ source: z.enum(['baseline', 'ai']), checkedInBlocks: count })
    .nullable(),
  tracks: z.array(track),
  baselinePlan: z.strictObject({ blocks: z.array(planBlockSchema) }),
  due: z.array(dueItem).max(CONTEXT_LIMITS.due),
  newQueueHead: z.array(newItem),
  deepDives: z.array(z.strictObject({ itemId: id, about: id })),
  weakTopics: z.array(z.string()),
  customItems: z.array(customItem),
  overrides: z.array(override),
  recent: z.strictObject({
    days: z.array(recentDay).max(CONTEXT_LIMITS.recentDays),
    results: z.array(recentResult).max(CONTEXT_LIMITS.recentResults),
  }),
  constraints: z.strictObject({
    /** The new-queue heads, cut to each track's effective cap; empty during an extra week. Capped
     *  at the 10-item head: a baseline with more than 10 new items cannot be reproduced exactly
     *  (safe — never faster than the baseline). */
    allowedNewItems: z.array(id),
    /** Due, then every other introduced item that is not mastered. */
    allowedReviewItems: z.array(id),
    maxPlannedMinutesRule: z.literal(MAX_PLANNED_MINUTES_RULE),
    customItems: z.strictObject({ remainingToday: count, remainingTotal: count }),
    overrides: z.strictObject({ remainingActive: z.record(z.string(), count) }),
    rationaleMaxChars: z.literal(CONTEXT_LIMITS.rationaleMaxChars),
  }),
  /** Only when the learner shares notes with the AI (§4.6, decision 32). */
  untrusted: z.strictObject({ notes: z.array(note).max(CONTEXT_LIMITS.notes) }).optional(),
})

export type BotContext = z.infer<typeof schema>

export const contextResponse: z.ZodType<BotContext> = schema
