/**
 * The one loader for derived writes (ADR-0007 "Loading derived state"; M4 final review I-1). A
 * write action loads exactly the rows its event reads with `loadDerivedFor`, then runs
 * `project(state, event)` → `derivedWrite(state, after, versions)` (`./derived`) and sends the
 * result with the event (`./apply`), all inside one `withRetry` attempt:
 * - an item outcome (`item.result`, `lesson.completed`, `exercise.submitted`, `prompt.completed`):
 *   the item's `item_state` row and the `daily_activity` row of the event's local day;
 *   `item.skipped` and `item.readded` (`outcome: false`): the item's row only;
 * - `block.checked_in` (the learner's or the auto check-in): the block's `plan_block_state` row;
 *   **every** `plan_block_state` row of the user counted for the day the block counts for — its
 *   stored `checked_in_on`, else the event's local day — of every plan, not just the block's
 *   (yesterday's paused plan and a "Học tiếp" plan share a day); and that day's `daily_activity`
 *   row. When the check-in moves the block (M-6 a: a stored `skipped` check-in becomes `done` /
 *   `partial` on a later local day), the same rows of the event's local day too.
 * A row missing from the database is sent as new (expected 0). A block of the day left out would
 * not be caught — `project` would recompute the day's `completed` from a partial set — which is
 * why the day's blocks are read whole, in pages of PostgREST's `max_rows`.
 *
 * Server-only and unguarded: the caller is guarded and passes the session client, so RLS limits
 * every read to the learner's own rows; `userId` filters them explicitly too.
 */
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  blockKey,
  type CheckInStatus,
  type DerivedState,
  type ItemState,
  isDoneOrPartial,
} from '@/lib/domain/state'
import type { LocalDay } from '@/lib/domain/time/localDay'
import type { Database } from '@/lib/supabase/database.types'
import {
  derivedStateFromRows,
  itemStateFromRow,
  type BlockStateRow,
  type DailyActivityRow,
  type ItemStateRow,
  type VersionMap,
} from './derived'

type Client = SupabaseClient<Database>

/** PostgREST's `max_rows` (supabase/config.toml): the most rows one request returns. */
const PAGE_ROWS = 1000
/** Item ids per `in (…)` filter: keeps the request URL short. */
const IDS_PER_REQUEST = 100

/** What a derived write is about to change — the rows `loadDerivedFor` reads follow from it. */
export type DerivedLoad =
  | {
      readonly kind: 'item'
      readonly itemId: string
      readonly localDay: LocalDay
      /** A counted outcome (the day's `items_done` may change); false for a skip or a re-add. */
      readonly outcome: boolean
    }
  | {
      readonly kind: 'block'
      readonly planId: string
      readonly blockId: string
      /** The event's local day. */
      readonly localDay: LocalDay
      /** The check-in's new status. */
      readonly status: CheckInStatus
    }

function failed(what: string, cause: unknown): Error {
  return new Error(`Could not read ${what}`, { cause })
}

async function readItemRow(
  supabase: Client,
  userId: string,
  itemId: string,
): Promise<ItemStateRow[]> {
  const { data, error } = await supabase
    .from('item_state')
    .select('*')
    .eq('user_id', userId)
    .eq('item_id', itemId)
    .maybeSingle()
  if (error) throw failed('the item state', error)
  return data === null ? [] : [data]
}

async function readDayRows(
  supabase: Client,
  userId: string,
  days: readonly LocalDay[],
): Promise<DailyActivityRow[]> {
  const { data, error } = await supabase
    .from('daily_activity')
    .select('*')
    .eq('user_id', userId)
    .in('local_day', [...days])
    .order('local_day')
  if (error) throw failed('the daily activity', error)
  return data
}

async function readBlockRow(
  supabase: Client,
  userId: string,
  planId: string,
  blockId: string,
): Promise<BlockStateRow | null> {
  const { data, error } = await supabase
    .from('plan_block_state')
    .select('*')
    .eq('user_id', userId)
    .eq('plan_id', planId)
    .eq('block_id', blockId)
    .maybeSingle()
  if (error) throw failed('the block check-in', error)
  return data
}

/** Every check-in of the user counted for one of `days`, of every plan, in pages. */
async function readBlocksOn(
  supabase: Client,
  userId: string,
  days: readonly LocalDay[],
): Promise<BlockStateRow[]> {
  const rows: BlockStateRow[] = []
  for (let from = 0; ; from += PAGE_ROWS) {
    const { data, error } = await supabase
      .from('plan_block_state')
      .select('*')
      .eq('user_id', userId)
      .in('checked_in_on', [...days])
      .order('plan_id')
      .order('block_id')
      .range(from, from + PAGE_ROWS - 1)
    if (error) throw failed("the day's check-ins", error)
    rows.push(...data)
    if (data.length < PAGE_ROWS) return rows
  }
}

/**
 * The days a check-in reads and writes: the day the block counts for (its stored `checked_in_on`,
 * else the event's), and the event's day too when the check-in moves the block there (M-6 a) —
 * the rule `project` applies.
 */
function countedDays(stored: BlockStateRow | null, load: DerivedLoad & { kind: 'block' }) {
  if (stored === null) return [load.localDay]
  // LocalDay is a zero-padded `YYYY-MM-DD` string: string order is chronological order.
  const moves =
    stored.status === 'skipped' &&
    isDoneOrPartial(load.status) &&
    load.localDay > stored.checked_in_on
  return moves ? [stored.checked_in_on, load.localDay] : [stored.checked_in_on]
}

/**
 * Exactly the rows the event reads (ADR-0007): an item outcome → the item's row and the day's row
 * (`outcome: false` for skip / re-add → the item's row only); a check-in → the block's row, every
 * block row of the user counted for the block's day (its existing checked_in_on, else localDay),
 * of every plan, and that day's row — and, when M-6 (a) moves the block (existing row skipped,
 * status done / partial, localDay later), the same for localDay too.
 */
export async function loadDerivedFor(
  supabase: Client,
  userId: string,
  load: DerivedLoad,
): Promise<{ readonly state: DerivedState; readonly versions: VersionMap }> {
  if (load.kind === 'item') {
    const [items, days] = await Promise.all([
      readItemRow(supabase, userId, load.itemId),
      load.outcome ? readDayRows(supabase, userId, [load.localDay]) : [],
    ])
    return derivedStateFromRows({ items, blocks: [], days })
  }

  const stored = await readBlockRow(supabase, userId, load.planId, load.blockId)
  const days = countedDays(stored, load)
  const [dayBlocks, dayRows] = await Promise.all([
    readBlocksOn(supabase, userId, days),
    readDayRows(supabase, userId, days),
  ])
  // The block's own row is among the day's unless it moved in between; the later read wins, and
  // a version that changed meanwhile makes the write conflict (and the caller retry).
  const blocks = new Map<string, BlockStateRow>()
  for (const row of [...(stored === null ? [] : [stored]), ...dayBlocks]) {
    blocks.set(blockKey(row.plan_id, row.block_id), row)
  }
  return derivedStateFromRows({ items: [], blocks: [...blocks.values()], days: dayRows })
}

/**
 * The item states of `itemIds` (the items of the blocks a result may complete, §5.5), keyed by
 * item id; items without a row are absent. Bounded: a block lists at most 500 items.
 */
export async function loadItemStates(
  supabase: Client,
  userId: string,
  itemIds: readonly string[],
): Promise<Record<string, ItemState>> {
  const ids = [...new Set(itemIds)]
  const rows: ItemStateRow[] = []
  for (let from = 0; from < ids.length; from += IDS_PER_REQUEST) {
    const { data, error } = await supabase
      .from('item_state')
      .select('*')
      .eq('user_id', userId)
      .in('item_id', ids.slice(from, from + IDS_PER_REQUEST))
    if (error) throw failed('the item states', error)
    rows.push(...data)
  }
  // Object.fromEntries defines own properties, so an ID such as `__proto__` is just a key.
  return Object.fromEntries(rows.map((row) => [row.item_id, itemStateFromRow(row)]))
}
