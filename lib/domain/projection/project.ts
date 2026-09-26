/**
 * Projection (platform design §4.1, §4.4, §5.3, §5.5, §5.7, §5.9; Part B-M4 decisions 6, 8, 9, 17,
 * 19): how one event changes the derived state — `item_state`, `plan_block_state` and
 * `daily_activity`. `projectChanges` computes the rows one event changes, reading `state` without
 * copying it; two appliers store them (M4 final review M-8): `projectEvent` into a new state —
 * `apply_event` stores what it computes (task 4.9b), `replay` folds it over a user's events
 * (ADR-0008) — and `applyChangesInPlace` into a working copy its caller owns (the simulation's
 * batch fold). One rule, two appliers: a property test folds random event sequences through both.
 * Pure: no clock reads, and no input is mutated — `applyChangesInPlace` changes only the
 * `MutableDerivedState` it is given, which `mutableCopy` made.
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
  isDoneOrPartial,
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

/** The rows one event changes, computed from `state` without copying it (M-8). */
export type RowChanges = {
  readonly items: readonly ItemState[]
  /** `item_state` rows that go (`track.reset`), by item ID. */
  readonly removedItems: readonly string[]
  readonly blocks: readonly BlockState[]
  readonly days: readonly DailyActivity[]
}

type Projected = { readonly changes: RowChanges; readonly ignored: IgnoreReason | null }

const NO_CHANGES: RowChanges = Object.freeze({
  items: Object.freeze([]),
  removedItems: Object.freeze([]),
  blocks: Object.freeze([]),
  days: Object.freeze([]),
})

const unchanged: Projected = { changes: NO_CHANGES, ignored: null }
const changed = (rows: Partial<RowChanges>): Projected => ({
  changes: { ...NO_CHANGES, ...rows },
  ignored: null,
})
const ignore = (reason: IgnoreReason): Projected => ({ changes: NO_CHANGES, ignored: reason })

/** The event's payload checked against its type's schema; a failure ignores the event. */
function withPayload<T extends EventType>(
  event: DomainEvent,
  type: T,
  apply: (payload: EventPayload<T>) => Projected,
): Projected {
  const schema: z.ZodType = EVENT_PAYLOADS[type]
  const parsed = schema.safeParse(event.payload)
  return parsed.success ? apply(parsed.data as EventPayload<T>) : ignore('invalid_payload')
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

function dayOf(state: DerivedState, localDay: LocalDay): DailyActivity {
  return (
    own(state.days, localDay) ?? { localDay, minutesByTrack: {}, itemsDone: 0, completed: false }
  )
}

/** A counted outcome: one more distinct item done that day (decision 8). */
function countedDay(state: DerivedState, localDay: LocalDay): DailyActivity {
  const day = dayOf(state, localDay)
  return { ...day, itemsDone: day.itemsDone + 1 }
}

/** `item.result` (§5.7): only the first result per item per day changes anything. */
function projectResult(
  state: DerivedState,
  event: DomainEvent,
  payload: EventPayload<'item.result'>,
  catalog: PlanCatalog,
): Projected {
  const item = catalogItem(event, catalog)
  if (typeof item === 'string') return ignore(item)
  if (item.srs === null) return ignore('not_srs')

  const row = own(state.items, item.id)
  const before = row ?? NOT_STARTED
  const after = applyResult(before, RESULT_OUTCOMES[payload.result], event.localDay, item.srs)
  if (after === before) return unchanged

  const base = row ?? { ...identityOf(item), introducedOn: event.localDay }
  const next: ItemState = { ...base, ...after, lastResult: payload.result }
  return changed({ items: [next], days: [countedDay(state, event.localDay)] })
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
): Projected {
  const item = catalogItem(event, catalog)
  if (typeof item === 'string') return ignore(item)
  if (item.itemType !== itemType || item.srs !== null) return ignore('wrong_type')

  const row = own(state.items, item.id)
  if (row?.lastResultOn === event.localDay) return unchanged

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
  return changed({ items: [next], days: [countedDay(state, event.localDay)] })
}

/** `item.skipped` (§5.3, §5.7): introduced, out of SRS; not an outcome, so the day is unchanged. */
function projectSkip(state: DerivedState, event: DomainEvent, catalog: PlanCatalog): Projected {
  const item = catalogItem(event, catalog)
  if (typeof item === 'string') return ignore(item)

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
  return changed({ items: [next] })
}

/** `item.readded` (§5.7): a mastered item back at the top level, due that day. */
function projectReadd(state: DerivedState, event: DomainEvent, catalog: PlanCatalog): Projected {
  const item = catalogItem(event, catalog)
  if (typeof item === 'string') return ignore(item)
  if (item.srs === null) return ignore('not_srs')

  const row = own(state.items, item.id)
  if (row === undefined) return ignore('unknown_item')
  const after = readd(row, event.localDay, item.srs)
  return after === row ? unchanged : changed({ items: [{ ...row, ...after }] })
}

/** `item.snapshot` (§4.7, decision 19): the row becomes the snapshot, whatever it was before. */
function projectSnapshot(
  event: DomainEvent,
  payload: EventPayload<'item.snapshot'>,
  catalog: PlanCatalog,
): Projected {
  const item = catalogItem(event, catalog)
  if (typeof item === 'string') return ignore(item)

  const { level, weak, topSuccesses, dueOn, lapses, reps } = payload
  const { introducedOn, lastResult, lastResultOn } = payload
  const status =
    item.srs === null || level === 0 ? 'ok' : srsStatus(level, weak, topSuccesses, item.srs)
  return changed({
    items: [
      {
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
      },
    ],
  })
}

/**
 * `block.checked_in` (§5.5, decisions 6 and 8): the block's latest check-in, counted for the day of
 * its first one, whose minutes and `completed` are recomputed from its blocks. One exception (M-6
 * a, owner ruling 2026-09-26): a `skipped` block checked in `done` / `partial` on a later local day
 * moves to that day — the earlier day is recomputed without it (it stays incomplete), the later day
 * with it, so resuming through a skipped block is that day's work (`gateStatus().resumedToday`).
 */
function projectCheckIn(
  state: DerivedState,
  event: DomainEvent,
  payload: EventPayload<'block.checked_in'>,
): Projected {
  const { planId, blockId, trackId } = event
  if (planId === null || blockId === null || trackId === null) return ignore('missing_keys')

  const row = own(state.blocks, blockKey(planId, blockId))
  const checkIn = {
    status: payload.status,
    minutes: payload.minutes,
    note: payload.note ?? null,
    auto: payload.auto ?? false,
  }
  if (row === undefined) {
    const block: BlockState = { planId, blockId, trackId, ...checkIn, checkedInOn: event.localDay }
    return changed({ blocks: [block], days: [dayWith(state, block, event.localDay)] })
  }

  // LocalDay is a zero-padded `YYYY-MM-DD` string: string order is chronological order.
  const resumed =
    row.status === 'skipped' && isDoneOrPartial(payload.status) && event.localDay > row.checkedInOn
  const block: BlockState = {
    ...row,
    ...checkIn,
    checkedInOn: resumed ? event.localDay : row.checkedInOn,
  }
  const days = resumed ? [row.checkedInOn, event.localDay] : [row.checkedInOn]
  return changed({ blocks: [block], days: days.map((day) => dayWith(state, block, day)) })
}

/** `localDay`'s `daily_activity` with `block` in place of its stored row (decision 8): minutes per
 *  track and `completed` from the blocks counted for that day; `itemsDone` kept. */
function dayWith(state: DerivedState, block: BlockState, localDay: LocalDay): DailyActivity {
  const key = blockKey(block.planId, block.blockId)
  const minutes = new Map<string, number>()
  let completed = false
  const count = (counted: BlockState): void => {
    if (counted.checkedInOn !== localDay) return
    minutes.set(counted.trackId, (minutes.get(counted.trackId) ?? 0) + counted.minutes)
    if (isDoneOrPartial(counted.status)) completed = true
  }
  // In table order, the changed block in its row's place (or last, when it is new).
  let stored = false
  for (const other of Object.keys(state.blocks)) {
    if (other === key) stored = true
    count(other === key ? block : (state.blocks[other] as BlockState))
  }
  if (!stored) count(block)
  return { ...dayOf(state, localDay), minutesByTrack: Object.fromEntries(minutes), completed }
}

/** `track.reset` (§5.9, decision 9): the track's item rows go; blocks and days stay (history). */
function projectReset(state: DerivedState, event: DomainEvent): Projected {
  const { trackId } = event
  if (trackId === null) return ignore('missing_keys')
  const removedItems = Object.values(state.items)
    .filter((row) => row.trackId === trackId)
    .map((row) => row.itemId)
  return changed({ removedItems })
}

/** `track.resumed` (§5.9, decision 9): the track's due dates move by the paused days. */
function projectResume(
  state: DerivedState,
  event: DomainEvent,
  payload: EventPayload<'track.resumed'>,
): Projected {
  const { trackId } = event
  if (trackId === null) return ignore('missing_keys')
  const items = Object.values(state.items).flatMap((row) =>
    row.trackId === trackId && row.dueOn !== null
      ? [{ ...row, dueOn: addDays(row.dueOn, payload.pausedDays) }]
      : [],
  )
  return changed({ items })
}

/**
 * The rows one event changes, and why it was ignored when it changed nothing it could have
 * changed. Events that never touch derived state (settings, schedules, admin, plan.generated, …)
 * change no row and return `ignored: null`, without checking their payload. Reads `state` without
 * copying or modifying it.
 */
export function projectChanges(
  state: DerivedState,
  event: DomainEvent,
  catalog: PlanCatalog,
): { readonly changes: RowChanges; readonly ignored: IgnoreReason | null } {
  switch (event.type) {
    case 'item.result':
      return withPayload(event, 'item.result', (payload) =>
        projectResult(state, event, payload, catalog),
      )
    case 'lesson.completed':
      return withPayload(event, 'lesson.completed', () =>
        projectCompletion(state, event, catalog, 'lesson', 'completed'),
      )
    case 'exercise.submitted':
      return withPayload(event, 'exercise.submitted', (payload) =>
        projectCompletion(state, event, catalog, 'exercise', payload.grade),
      )
    case 'prompt.completed':
      return withPayload(event, 'prompt.completed', () =>
        projectCompletion(state, event, catalog, 'prompt', 'completed'),
      )
    case 'item.skipped':
      return withPayload(event, 'item.skipped', () => projectSkip(state, event, catalog))
    case 'item.readded':
      return withPayload(event, 'item.readded', () => projectReadd(state, event, catalog))
    case 'item.snapshot':
      return withPayload(event, 'item.snapshot', (payload) =>
        projectSnapshot(event, payload, catalog),
      )
    case 'block.checked_in':
      return withPayload(event, 'block.checked_in', (payload) =>
        projectCheckIn(state, event, payload),
      )
    case 'track.reset':
      return withPayload(event, 'track.reset', () => projectReset(state, event))
    case 'track.resumed':
      return withPayload(event, 'track.resumed', (payload) => projectResume(state, event, payload))
    default:
      return unchanged
  }
}

// ---------------------------------------------------------------------------------------------
// The two appliers
// ---------------------------------------------------------------------------------------------

const itemKey = (row: ItemState): string => row.itemId
const blockKeyOf = (block: BlockState): string => blockKey(block.planId, block.blockId)
const dayKey = (day: DailyActivity): string => day.localDay

/** `table[key] = row` as an own data property, so a key such as `__proto__` stays a key. */
function put<T>(table: Record<string, T>, key: string, row: T): void {
  if (key === '__proto__') {
    Object.defineProperty(table, key, {
      value: row,
      writable: true,
      enumerable: true,
      configurable: true,
    })
  } else {
    table[key] = row
  }
}

/** `table` with `rows` stored and `removed` deleted; the same object when neither has any. */
function withRows<T>(
  table: Readonly<Record<string, T>>,
  rows: readonly T[],
  keyOf: (row: T) => string,
  removed: readonly string[] = [],
): Readonly<Record<string, T>> {
  if (rows.length === 0 && removed.length === 0) return table
  const next = { ...table }
  for (const key of removed) Reflect.deleteProperty(next, key)
  for (const row of rows) put(next, keyOf(row), row)
  return next
}

/** A derived state whose tables its owner changes in place — the simulation's working copy
 *  (M-8), never a state someone else holds. For the simulation and tests only — screens and
 *  actions use `project` / `projectEvent`. */
export type MutableDerivedState = {
  items: Record<string, ItemState>
  blocks: Record<string, BlockState>
  days: Record<LocalDay, DailyActivity>
}

/** A working copy of `state`: new tables holding the same rows (rows are never changed). For the
 *  simulation and tests only — screens and actions use `project` / `projectEvent`. */
export function mutableCopy(state: DerivedState): MutableDerivedState {
  return { items: { ...state.items }, blocks: { ...state.blocks }, days: { ...state.days } }
}

/** Stores `changes` in `target` — the batch fold's applier (M-8): no table is copied. For the
 *  simulation and tests only — screens and actions use `project` / `projectEvent`. */
export function applyChangesInPlace(target: MutableDerivedState, changes: RowChanges): void {
  for (const key of changes.removedItems) Reflect.deleteProperty(target.items, key)
  for (const row of changes.items) put(target.items, itemKey(row), row)
  for (const block of changes.blocks) put(target.blocks, blockKeyOf(block), block)
  for (const day of changes.days) put(target.days, dayKey(day), day)
}

/**
 * Applies one event: `projectChanges`, then a new state with those rows (a table no row changes
 * is kept as the same object; an event that changes nothing returns `state` itself). Never
 * mutates `state`.
 */
export function projectEvent(
  state: DerivedState,
  event: DomainEvent,
  catalog: PlanCatalog,
): { readonly state: DerivedState; readonly ignored: IgnoreReason | null } {
  const { changes, ignored } = projectChanges(state, event, catalog)
  const { items, removedItems, blocks, days } = changes
  if (items.length + removedItems.length + blocks.length + days.length === 0) {
    return { state, ignored }
  }
  return {
    state: {
      items: withRows(state.items, items, itemKey, removedItems),
      blocks: withRows(state.blocks, blocks, blockKeyOf),
      days: withRows(state.days, days, dayKey),
    },
    ignored,
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
