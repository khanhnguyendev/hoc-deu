/**
 * The check-in and result inputs (platform design §4.4, §5.5; Part B-M5 decisions 14–17, RF-3)
 * and their event payloads. Browser-safe — zod, the pure domain and the strings only — so the
 * check-in sheet applies the server's note rules as the learner types (`noteError`). The event
 * keys, which digest these payloads with `node:crypto`, are server-side: `./event-keys`.
 */
import { z } from 'zod'
import {
  EVENT_PAYLOADS,
  jsonbTextBytes,
  MAX_PAYLOAD_BYTES,
  type EventPayload,
} from '@/lib/domain/events'
import type { ResultName } from '@/lib/domain/srs/outcomes'
import { CHECK_IN_STATUSES, type CheckInStatus } from '@/lib/domain/state'
import { vi } from '@/lib/i18n/vi'

const errors = vi.checkIn.errors

/** A note's limit in user-perceived characters (RF-3). */
export const NOTE_MAX_GRAPHEMES = 280
/** The payload schema's bound on `note`, in UTF-16 code units (`block.checked_in`, §4.4). */
const NOTE_MAX_UNITS = 1000

/** NFC, trimmed; empty → undefined. */
export function normalizeNote(raw: string): string | undefined {
  const note = raw.normalize('NFC').trim()
  return note === '' ? undefined : note
}

let segmenter: Intl.Segmenter | undefined

/** User-perceived characters (Intl.Segmenter, 'vi', grapheme). */
export function graphemeCount(text: string): number {
  segmenter ??= new Intl.Segmenter('vi', { granularity: 'grapheme' })
  return Array.from(segmenter.segment(text)).length
}

/**
 * Whether `note` fits: at most 280 graphemes, at most 1000 UTF-16 units (the payload schema's
 * bound) and, in the largest payload it can travel in, at most `MAX_PAYLOAD_BYTES` of jsonb text —
 * 1000 units of three-byte characters or JSON escapes would pass the first two and still be
 * refused by the database (RF-3). One message for all three.
 */
function noteFits(note: string): boolean {
  return (
    note.length <= NOTE_MAX_UNITS &&
    graphemeCount(note) <= NOTE_MAX_GRAPHEMES &&
    jsonbTextBytes({ status: 'partial', minutes: 600, note, auto: false }) <= MAX_PAYLOAD_BYTES
  )
}

/** jsonb stores neither U+0000 nor an unpaired surrogate (`parseEventPayload`). */
const storable = (note: string): boolean => !note.includes('\u0000') && note.isWellFormed()

/**
 * The server's rules for a raw note, for the sheet to apply as the learner types (RF-3): null when
 * it is fine (a blank note included — it is dropped), else the message the server would answer —
 * "Ghi chú quá dài" for any of the three bounds (`noteFits`), else "invalid" for text jsonb cannot
 * store. `checkInInputSchema` checks exactly this.
 */
export function noteError(raw: string): string | null {
  const note = normalizeNote(raw)
  if (note === undefined) return null
  if (!noteFits(note)) return errors.noteTooLong
  return storable(note) ? null : errors.invalid
}

const noteSchema = z
  .string()
  .superRefine((raw, ctx) => {
    const message = noteError(raw)
    if (message !== null) ctx.addIssue({ code: 'custom', message })
  })
  .transform(normalizeNote)

const requestId = z.uuid()
/** `planBlockSchema`'s bounds on block and item ids. */
const blockId = z.string().min(1).max(128)
const itemId = z.string().min(1).max(128)

export type CheckInInput = {
  readonly requestId: string
  readonly planId: string
  readonly blockId: string
  readonly status: CheckInStatus
  /** Omitted = checkInMinutes(block) (one-tap, decision 34 of M4); 0 for a skip. */
  readonly minutes?: number
  readonly note?: string
}

export const checkInInputSchema: z.ZodType<CheckInInput> = z.strictObject({
  requestId,
  planId: z.uuid(),
  blockId,
  status: z.enum(CHECK_IN_STATUSES),
  minutes: EVENT_PAYLOADS['block.checked_in'].shape.minutes.optional(),
  note: noteSchema.optional(),
})

export type Outcome =
  | { readonly type: 'item.result'; readonly result: ResultName; readonly mode?: 'recall' | 'redo' }
  | { readonly type: 'lesson.completed'; readonly quizScore?: number }
  | {
      readonly type: 'exercise.submitted'
      readonly kind: string
      readonly grade: 'pass' | 'close' | 'miss'
    }
  | { readonly type: 'prompt.completed'; readonly selfRating?: 1 | 2 | 3 }
  | { readonly type: 'item.skipped' }
  | { readonly type: 'item.readded' }

export type OutcomeInput = {
  readonly requestId: string
  readonly itemId: string
  /** From `?block=`: prefers this block when several list the item (decision 14). */
  readonly blockId?: string
  readonly outcome: Outcome
}

/** Each outcome is its event's payload schema (§4.4) with the event type; strict, like them. */
const outcomeSchema = z.discriminatedUnion('type', [
  EVENT_PAYLOADS['item.result'].extend({ type: z.literal('item.result') }),
  EVENT_PAYLOADS['lesson.completed'].extend({ type: z.literal('lesson.completed') }),
  EVENT_PAYLOADS['exercise.submitted'].extend({
    type: z.literal('exercise.submitted'),
    kind: z.string().min(1).max(32),
  }),
  EVENT_PAYLOADS['prompt.completed'].extend({ type: z.literal('prompt.completed') }),
  EVENT_PAYLOADS['item.skipped'].extend({ type: z.literal('item.skipped') }),
  EVENT_PAYLOADS['item.readded'].extend({ type: z.literal('item.readded') }),
])

export const outcomeInputSchema: z.ZodType<OutcomeInput> = z.strictObject({
  requestId,
  itemId,
  blockId: blockId.optional(),
  outcome: outcomeSchema,
})

type OutcomeType = Outcome['type']

/** An outcome as its event: the type and the payload, keys in one fixed order. */
export type OutcomeEvent = {
  [T in OutcomeType]: { readonly type: T; readonly payload: EventPayload<T> }
}[OutcomeType]

export function outcomeEvent(outcome: Outcome): OutcomeEvent {
  switch (outcome.type) {
    case 'item.result':
      return {
        type: outcome.type,
        payload:
          outcome.mode === undefined
            ? { result: outcome.result }
            : { result: outcome.result, mode: outcome.mode },
      }
    case 'lesson.completed':
      return {
        type: outcome.type,
        payload: outcome.quizScore === undefined ? {} : { quizScore: outcome.quizScore },
      }
    case 'exercise.submitted':
      return { type: outcome.type, payload: { kind: outcome.kind, grade: outcome.grade } }
    case 'prompt.completed':
      return {
        type: outcome.type,
        payload: outcome.selfRating === undefined ? {} : { selfRating: outcome.selfRating },
      }
    case 'item.skipped':
    case 'item.readded':
      return { type: outcome.type, payload: {} }
  }
}

/** A counted outcome (§5.3): the day's `items_done` may change. A skip or a re-add is not one. */
export function isCountedOutcome(type: OutcomeType): boolean {
  return type !== 'item.skipped' && type !== 'item.readded'
}

/** The check-in's payload, keys in one fixed order; no note when there is none. */
export function checkInPayload(
  input: CheckInInput & { readonly minutes: number },
): EventPayload<'block.checked_in'> {
  const { status, minutes, note } = input
  return note === undefined ? { status, minutes } : { status, minutes, note }
}
