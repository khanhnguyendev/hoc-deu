/**
 * Projection (platform design §4.1, §4.4, §5.3, §5.7, §5.9; Part B-M4 decisions 8, 9, 17, 19): how
 * one event changes the derived state — `item_state`, `plan_block_state` and `daily_activity`.
 * `apply_event` stores what `projectEvent` computes (task 4.9b); `replay` folds it over a user's
 * events (ADR-0008). Pure: no clock reads, and no input is mutated.
 */
import type { z } from 'zod'
import type { PlanCatalog, PlanItem } from '../catalog'
import { own } from '../compare'
import { EVENT_PAYLOADS, type EventPayload, type EventType } from '../events'
import { applyResult, NOT_STARTED, readd, srsStatus } from '../srs/applyResult'
import { RESULT_OUTCOMES } from '../srs/outcomes'
import {
  blockKey,
  type BlockState,
  type DailyActivity,
  type DerivedState,
  type ItemState,
} from '../state'
import { addDays, type LocalDay } from '../time/localDay'

/** An `events` row as the engine reads it (payload not yet validated). */
export type DomainEvent = {
  readonly id: string
  readonly type: EventType
  /** ISO-8601 instant (`occurred_at`). */
  readonly occurredAt: string
  /** The event's local day, computed by the database (§4.5). */
  readonly localDay: LocalDay
  readonly trackId: string | null
  readonly itemId: string | null
  readonly planId: string | null
  readonly blockId: string | null
  readonly payload: unknown
  readonly rulesVersion: number
}

export type IgnoreReason =
  'invalid_payload' | 'unknown_item' | 'not_srs' | 'wrong_type' | 'missing_keys'

type Projection = { readonly state: DerivedState; readonly ignored: IgnoreReason | null }

const applied = (state: DerivedState): Projection => ({ state, ignored: null })
const ignore = (state: DerivedState, reason: IgnoreReason): Projection => ({
  state,
  ignored: reason,
})

/** The event's payload checked against its type's schema; a failure ignores the event. */
function withPayload<T extends EventType>(
  state: DerivedState,
  event: DomainEvent,
  type: T,
  apply: (payload: EventPayload<T>) => Projection,
): Projection {
  const schema: z.ZodType = EVENT_PAYLOADS[type]
  const parsed = schema.safeParse(event.payload)
  return parsed.success ? apply(parsed.data as EventPayload<T>) : ignore(state, 'invalid_payload')
}

/** The catalog item the event names, or why there is none. */
function catalogItem(
  event: DomainEvent,
  catalog: PlanCatalog,
): PlanItem | 'missing_keys' | 'unknown_item' {
  if (event.itemId === null) return 'missing_keys'
  return own(catalog.items, event.itemId) ?? 'unknown_item'
}

/** The fields a new `item_state` row copies from the catalog (§4.1). */
const identityOf = (
  item: PlanItem,
): Pick<ItemState, 'itemId' | 'trackId' | 'topicId' | 'itemType'> => ({
  itemId: item.id,
  trackId: item.trackId,
  topicId: item.topicId,
  itemType: item.itemType,
})

function setItem(state: DerivedState, row: ItemState): DerivedState {
  return { ...state, items: { ...state.items, [row.itemId]: row } }
}

function setBlock(state: DerivedState, block: BlockState): DerivedState {
  return { ...state, blocks: { ...state.blocks, [blockKey(block.planId, block.blockId)]: block } }
}

function setDay(state: DerivedState, day: DailyActivity): DerivedState {
  return { ...state, days: { ...state.days, [day.localDay]: day } }
}

function dayOf(state: DerivedState, localDay: LocalDay): DailyActivity {
  return (
    own(state.days, localDay) ?? { localDay, minutesByTrack: {}, itemsDone: 0, completed: false }
  )
}

/** A counted outcome: one more distinct item done that day (decision 8). */
function countOutcome(state: DerivedState, localDay: LocalDay): DerivedState {
  const day = dayOf(state, localDay)
  return setDay(state, { ...day, itemsDone: day.itemsDone + 1 })
}

/** `item.result` (§5.7): only the first result per item per day changes anything. */
function projectResult(
  state: DerivedState,
  event: DomainEvent,
  payload: EventPayload<'item.result'>,
  catalog: PlanCatalog,
): Projection {
  const item = catalogItem(event, catalog)
  if (typeof item === 'string') return ignore(state, item)
  if (item.srs === null) return ignore(state, 'not_srs')

  const row = own(state.items, item.id)
  const before = row ?? NOT_STARTED
  const after = applyResult(before, RESULT_OUTCOMES[payload.result], event.localDay, item.srs)
  if (after === before) return applied(state)

  const base = row ?? { ...identityOf(item), introducedOn: event.localDay }
  const next: ItemState = { ...base, ...after, lastResult: payload.result }
  return applied(countOutcome(setItem(state, next), event.localDay))
}

/**
 * `lesson.completed`, `exercise.submitted`, `prompt.completed` (§5.3, decision 17): a level-0 row
 * for a completion-only item of `itemType`, counted once per item per day. Any other item is
 * `wrong_type`, so a completion never uses up an SRS item's result for the day.
 */
function projectCompletion(
  state: DerivedState,
  event: DomainEvent,
  catalog: PlanCatalog,
  itemType: string,
  lastResult: string,
): Projection {
  const item = catalogItem(event, catalog)
  if (typeof item === 'string') return ignore(state, item)
  if (item.itemType !== itemType || item.srs !== null) return ignore(state, 'wrong_type')

  const row = own(state.items, item.id)
  if (row?.lastResultOn === event.localDay) return applied(state)

  const next: ItemState =
    row === undefined
      ? {
          ...identityOf(item),
          ...NOT_STARTED,
          reps: 1,
          introducedOn: event.localDay,
          lastResult,
          lastResultOn: event.localDay,
        }
      : {
          ...row,
          status: row.status === 'skipped' ? 'ok' : row.status,
          reps: row.reps + 1,
          lastResult,
          lastResultOn: event.localDay,
        }
  return applied(countOutcome(setItem(state, next), event.localDay))
}

/** `item.skipped` (§5.3, §5.7): introduced, out of SRS; not an outcome, so the day is unchanged. */
function projectSkip(state: DerivedState, event: DomainEvent, catalog: PlanCatalog): Projection {
  const item = catalogItem(event, catalog)
  if (typeof item === 'string') return ignore(state, item)

  const row = own(state.items, item.id)
  const next: ItemState =
    row === undefined
      ? {
          ...identityOf(item),
          ...NOT_STARTED,
          status: 'skipped',
          introducedOn: event.localDay,
          lastResult: null,
        }
      : { ...row, status: 'skipped', dueOn: null }
  return applied(setItem(state, next))
}

/** `item.readded` (§5.7): a mastered item back at the top level, due that day. */
function projectReadd(state: DerivedState, event: DomainEvent, catalog: PlanCatalog): Projection {
  const item = catalogItem(event, catalog)
  if (typeof item === 'string') return ignore(state, item)
  if (item.srs === null) return ignore(state, 'not_srs')

  const row = own(state.items, item.id)
  if (row === undefined) return ignore(state, 'unknown_item')
  const after = readd(row, event.localDay, item.srs)
  return after === row ? applied(state) : applied(setItem(state, { ...row, ...after }))
}

/** `item.snapshot` (§4.7, decision 19): the row becomes the snapshot, whatever it was before. */
function projectSnapshot(
  state: DerivedState,
  event: DomainEvent,
  payload: EventPayload<'item.snapshot'>,
  catalog: PlanCatalog,
): Projection {
  const item = catalogItem(event, catalog)
  if (typeof item === 'string') return ignore(state, item)

  const { level, weak, topSuccesses, dueOn, lapses, reps } = payload
  const { introducedOn, lastResult, lastResultOn } = payload
  const status =
    item.srs === null || level === 0 ? 'ok' : srsStatus(level, weak, topSuccesses, item.srs)
  return applied(
    setItem(state, {
      ...identityOf(item),
      level,
      weak,
      topSuccesses,
      status,
      dueOn,
      lastResult,
      lastResultOn,
      introducedOn,
      lapses,
      reps,
    }),
  )
}

/**
 * `block.checked_in` (§5.5, decisions 6 and 8): the block's latest check-in, counted for the day of
 * its first one; that day's minutes and `completed` are recomputed from its blocks.
 */
function projectCheckIn(
  state: DerivedState,
  event: DomainEvent,
  payload: EventPayload<'block.checked_in'>,
): Projection {
  const { planId, blockId, trackId } = event
  if (planId === null || blockId === null || trackId === null) {
    return ignore(state, 'missing_keys')
  }

  const row = own(state.blocks, blockKey(planId, blockId))
  const checkIn = {
    status: payload.status,
    minutes: payload.minutes,
    note: payload.note ?? null,
    auto: payload.auto ?? false,
  }
  const block: BlockState =
    row === undefined
      ? { planId, blockId, trackId, ...checkIn, checkedInOn: event.localDay }
      : { ...row, ...checkIn }
  return applied(recomputeDay(setBlock(state, block), block.checkedInOn))
}

/** `daily_activity` minutes and `completed` from the blocks counted for `localDay`. */
function recomputeDay(state: DerivedState, localDay: LocalDay): DerivedState {
  const blocks = Object.values(state.blocks).filter((block) => block.checkedInOn === localDay)
  const minutes = new Map<string, number>()
  for (const block of blocks) {
    minutes.set(block.trackId, (minutes.get(block.trackId) ?? 0) + block.minutes)
  }
  return setDay(state, {
    ...dayOf(state, localDay),
    minutesByTrack: Object.fromEntries(minutes),
    completed: blocks.some((block) => block.status === 'done' || block.status === 'partial'),
  })
}

/** `track.reset` (§5.9, decision 9): the track's item rows go; blocks and days stay (history). */
function projectReset(state: DerivedState, event: DomainEvent): Projection {
  const { trackId } = event
  if (trackId === null) return ignore(state, 'missing_keys')
  const items = Object.entries(state.items).filter(([, row]) => row.trackId !== trackId)
  return applied({ ...state, items: Object.fromEntries(items) })
}

/** `track.resumed` (§5.9, decision 9): the track's due dates move by the paused days. */
function projectResume(
  state: DerivedState,
  event: DomainEvent,
  payload: EventPayload<'track.resumed'>,
): Projection {
  const { trackId } = event
  if (trackId === null) return ignore(state, 'missing_keys')
  const items = Object.entries(state.items).map(([id, row]): [string, ItemState] =>
    row.trackId === trackId && row.dueOn !== null
      ? [id, { ...row, dueOn: addDays(row.dueOn, payload.pausedDays) }]
      : [id, row],
  )
  return applied({ ...state, items: Object.fromEntries(items) })
}

/**
 * Applies one event. `ignored` says why an event changed nothing it could have changed; events
 * that never touch derived state (settings, schedules, admin, plan.generated, …) return
 * `ignored: null` and the same state object, without checking their payload. Never mutates
 * `state`.
 */
export function projectEvent(
  state: DerivedState,
  event: DomainEvent,
  catalog: PlanCatalog,
): { readonly state: DerivedState; readonly ignored: IgnoreReason | null } {
  switch (event.type) {
    case 'item.result':
      return withPayload(state, event, 'item.result', (payload) =>
        projectResult(state, event, payload, catalog),
      )
    case 'lesson.completed':
      return withPayload(state, event, 'lesson.completed', () =>
        projectCompletion(state, event, catalog, 'lesson', 'completed'),
      )
    case 'exercise.submitted':
      return withPayload(state, event, 'exercise.submitted', (payload) =>
        projectCompletion(state, event, catalog, 'exercise', payload.grade),
      )
    case 'prompt.completed':
      return withPayload(state, event, 'prompt.completed', () =>
        projectCompletion(state, event, catalog, 'prompt', 'completed'),
      )
    case 'item.skipped':
      return withPayload(state, event, 'item.skipped', () => projectSkip(state, event, catalog))
    case 'item.readded':
      return withPayload(state, event, 'item.readded', () => projectReadd(state, event, catalog))
    case 'item.snapshot':
      return withPayload(state, event, 'item.snapshot', (payload) =>
        projectSnapshot(state, event, payload, catalog),
      )
    case 'block.checked_in':
      return withPayload(state, event, 'block.checked_in', (payload) =>
        projectCheckIn(state, event, payload),
      )
    case 'track.reset':
      return withPayload(state, event, 'track.reset', () => projectReset(state, event))
    case 'track.resumed':
      return withPayload(state, event, 'track.resumed', (payload) =>
        projectResume(state, event, payload),
      )
    default:
      return applied(state)
  }
}

/** `projectEvent(...).state`. */
export function project(
  state: DerivedState,
  event: DomainEvent,
  catalog: PlanCatalog,
): DerivedState {
  return projectEvent(state, event, catalog).state
}
