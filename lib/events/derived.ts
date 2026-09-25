/**
 * Derived rows ↔ domain state (platform design §4.1, §4.3, §4.4; Part B-M4 decision 10). The
 * engine (`lib/domain/projection`) computes `DerivedState`; `apply_event` stores the rows that
 * changed, each with the version it was read at, through `apply_derived_changes`. Server code, but
 * not `server-only`: pure mapping, no I/O.
 */
import { z } from 'zod'
import {
  blockKey,
  CHECK_IN_STATUSES,
  ITEM_STATE_STATUSES,
  type BlockState,
  type CheckInStatus,
  type DailyActivity,
  type DerivedState,
  type ItemState,
  type ItemStateStatus,
} from '@/lib/domain/state'
import type { LocalDay } from '@/lib/domain/time/localDay'
import type { Database, Json } from '@/lib/supabase/database.types'

type Tables = Database['public']['Tables']
export type ItemStateRow = Tables['item_state']['Row']
export type BlockStateRow = Tables['plan_block_state']['Row']
export type DailyActivityRow = Tables['daily_activity']['Row']

/** The `version` of each derived row as it was read; a row not listed does not exist yet. */
export type VersionMap = {
  readonly items: Readonly<Record<string, number>>
  /** Keyed by `blockKey(planId, blockId)`. */
  readonly blocks: Readonly<Record<string, number>>
  readonly days: Readonly<Record<LocalDay, number>>
}

export const NO_VERSIONS: VersionMap = { items: {}, blocks: {}, days: {} }

/** `apply_event`'s `p_changes` (`[{ table, row }]`, snake_case rows) and `p_expected`. */
export type DerivedWrite = {
  readonly changes: Json[]
  readonly expected: Record<string, number>
}

/** Structural equality of plain data (the derived state is JSON-shaped). */
function sameData(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  return (
    aKeys.length === bKeys.length &&
    aKeys.every(
      (key) =>
        Object.hasOwn(b, key) &&
        sameData((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
    )
  )
}

/** `record[key]` for an own key only, so an ID such as `constructor` finds nothing. */
function own<T>(record: Readonly<Record<string, T>>, key: string): T | undefined {
  return Object.hasOwn(record, key) ? record[key] : undefined
}

function itemStateToRow(state: ItemState): { [column: string]: Json } {
  return {
    item_id: state.itemId,
    track_id: state.trackId,
    topic_id: state.topicId,
    item_type: state.itemType,
    level: state.level,
    weak: state.weak,
    top_successes: state.topSuccesses,
    status: state.status,
    due_on: state.dueOn,
    last_result: state.lastResult,
    last_result_on: state.lastResultOn,
    introduced_on: state.introducedOn,
    lapses: state.lapses,
    reps: state.reps,
  }
}

/** `checked_in_on` is sent for completeness; the database sets it on insert and keeps it. */
function blockStateToRow(state: BlockState): { [column: string]: Json } {
  return {
    plan_id: state.planId,
    block_id: state.blockId,
    track_id: state.trackId,
    status: state.status,
    minutes: state.minutes,
    note: state.note,
    auto: state.auto,
    checked_in_on: state.checkedInOn,
  }
}

function dailyActivityToRow(day: DailyActivity): { [column: string]: Json } {
  return {
    local_day: day.localDay,
    minutes_by_track: { ...day.minutesByTrack },
    items_done: day.itemsDone,
    completed: day.completed,
  }
}

type TableWrite<T> = {
  readonly table: 'item_state' | 'plan_block_state' | 'daily_activity'
  readonly before: Readonly<Record<string, T>>
  readonly after: Readonly<Record<string, T>>
  readonly versions: Readonly<Record<string, number>>
  /** The key `apply_derived_changes` gives the row (`<table>:<…>`). */
  readonly keyOf: (row: T) => string
  readonly toRow: (row: T) => { [column: string]: Json }
}

function tableWrite<T>(
  { table, before, after, versions, keyOf, toRow }: TableWrite<T>,
  write: { changes: Json[]; expected: Record<string, number> },
): void {
  for (const key of Object.keys(before)) {
    if (!Object.hasOwn(after, key)) {
      throw new Error(`derivedWrite: ${table} row ${key} was deleted; only SQL deletes rows`)
    }
  }
  for (const key of Object.keys(after).sort()) {
    const next = after[key] as T
    if (Object.hasOwn(before, key) && sameData(before[key], next)) continue
    write.changes.push({ table, row: toRow(next) })
    write.expected[keyOf(next)] = own(versions, key) ?? 0
  }
}

/**
 * The rows that differ between `before` and `after` (deep equality) as p_changes, each with its
 * version from `versions` (0 when absent) in p_expected. Used only for the event types of the
 * `apply_derived_changes` table (item results and completions, skips, re-adds, snapshots,
 * check-ins); every other type — `track.reset` and `track.resumed` included, whose derived effects
 * SQL applies itself — sends no derived write. A row missing from `after` throws (deletions happen
 * only in SQL). Rows come in table order (items, blocks, days), each table sorted by key.
 */
export function derivedWrite(
  before: DerivedState,
  after: DerivedState,
  versions: VersionMap,
): DerivedWrite {
  const write: { changes: Json[]; expected: Record<string, number> } = {
    changes: [],
    expected: {},
  }
  tableWrite(
    {
      table: 'item_state',
      before: before.items,
      after: after.items,
      versions: versions.items,
      keyOf: (row) => `item_state:${row.itemId}`,
      toRow: itemStateToRow,
    },
    write,
  )
  tableWrite(
    {
      table: 'plan_block_state',
      before: before.blocks,
      after: after.blocks,
      versions: versions.blocks,
      keyOf: (row) => `plan_block_state:${blockKey(row.planId, row.blockId)}`,
      toRow: blockStateToRow,
    },
    write,
  )
  tableWrite(
    {
      table: 'daily_activity',
      before: before.days,
      after: after.days,
      versions: versions.days,
      keyOf: (row) => `daily_activity:${row.localDay}`,
      toRow: dailyActivityToRow,
    },
    write,
  )
  return write
}

/** A value the database's check constraint allows; anything else is a bug worth failing on. */
function oneOf<T extends string>(values: readonly T[], value: string, column: string): T {
  if ((values as readonly string[]).includes(value)) return value as T
  throw new Error(`Unexpected ${column} "${value}" in a derived row`)
}

const minutesByTrackSchema = z.record(z.string(), z.number())

export function itemStateFromRow(row: ItemStateRow): ItemState {
  return {
    itemId: row.item_id,
    trackId: row.track_id,
    topicId: row.topic_id,
    itemType: row.item_type,
    level: row.level,
    weak: row.weak,
    topSuccesses: row.top_successes,
    status: oneOf<ItemStateStatus>(ITEM_STATE_STATUSES, row.status, 'item_state.status'),
    dueOn: row.due_on,
    lastResult: row.last_result,
    lastResultOn: row.last_result_on,
    introducedOn: row.introduced_on,
    lapses: row.lapses,
    reps: row.reps,
  }
}

export function blockStateFromRow(row: BlockStateRow): BlockState {
  return {
    planId: row.plan_id,
    blockId: row.block_id,
    trackId: row.track_id,
    status: oneOf<CheckInStatus>(CHECK_IN_STATUSES, row.status, 'plan_block_state.status'),
    minutes: row.minutes,
    note: row.note,
    auto: row.auto,
    checkedInOn: row.checked_in_on,
  }
}

/** `minutes_by_track` is free-form jsonb: anything but `{ track: number }` reads as `{}`. */
export function dailyActivityFromRow(row: DailyActivityRow): DailyActivity {
  const minutes = minutesByTrackSchema.safeParse(row.minutes_by_track)
  return {
    localDay: row.local_day,
    minutesByTrack: minutes.success ? minutes.data : {},
    itemsDone: row.items_done,
    completed: row.completed,
  }
}

/** The derived state and the version of each row, from the rows as the database returns them. */
export function derivedStateFromRows(rows: {
  readonly items: readonly ItemStateRow[]
  readonly blocks: readonly BlockStateRow[]
  readonly days: readonly DailyActivityRow[]
}): { readonly state: DerivedState; readonly versions: VersionMap } {
  // Object.fromEntries defines own properties, so an ID such as `__proto__` is just a key.
  const blockKeyOf = (row: BlockStateRow) => blockKey(row.plan_id, row.block_id)
  return {
    state: {
      items: Object.fromEntries(rows.items.map((row) => [row.item_id, itemStateFromRow(row)])),
      blocks: Object.fromEntries(
        rows.blocks.map((row) => [blockKeyOf(row), blockStateFromRow(row)]),
      ),
      days: Object.fromEntries(rows.days.map((row) => [row.local_day, dailyActivityFromRow(row)])),
    },
    versions: {
      items: Object.fromEntries(rows.items.map((row) => [row.item_id, row.version])),
      blocks: Object.fromEntries(rows.blocks.map((row) => [blockKeyOf(row), row.version])),
      days: Object.fromEntries(rows.days.map((row) => [row.local_day, row.version])),
    },
  }
}
