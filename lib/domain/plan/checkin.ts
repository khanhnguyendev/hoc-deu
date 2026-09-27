/**
 * The check-in rules a result needs (platform design §5.5; Part B-M5 decisions 14 and 15, as
 * amended by ruling M5-R36): whether an item is handled or studied for a plan, which of the plan's
 * blocks list it, which blocks the server checks in automatically after the result, and with how
 * many minutes. Pure: the caller loads the plan, its block states and the item states, and decides
 * this inside each retry attempt, on the rows it just reloaded — so a block the learner checked in
 * meanwhile (the sheet racing the auto check-in) is left alone.
 */
import { own } from '../compare'
import { blockKey, type BlockState, type ItemState } from '../state'
import type { LocalDay } from '../time/localDay'
import type { PlanBlock, StoredPlan } from './types'

/** Studied for a plan dated `planDate` (ruling M5-R36): a result on or after that day. A skip is
 *  not a result (§4.1): an item skipped without one is handled, never studied — while an item
 *  skipped after such a result was studied (the result counts). */
export function itemStudied(
  itemId: string,
  planDate: LocalDay,
  items: Readonly<Record<string, ItemState>>,
): boolean {
  const state = own(items, itemId)
  // LocalDay is a zero-padded `YYYY-MM-DD` string: string order is chronological order.
  return state !== undefined && state.lastResultOn !== null && state.lastResultOn >= planDate
}

/** Handled for a plan dated `planDate` (decision 15): studied (`itemStudied`), or skipped. */
export function itemHandled(
  itemId: string,
  planDate: LocalDay,
  items: Readonly<Record<string, ItemState>>,
): boolean {
  return own(items, itemId)?.status === 'skipped' || itemStudied(itemId, planDate, items)
}

/**
 * The minutes the auto check-in of `block` records (decision 15, ruling M5-R36): the ceiling of
 * the minutes of its items studied for `planDate` — a skipped item credits nothing. With every item
 * studied it is `checkInMinutes(block)` (a block's `estMinutes` is the sum of its items' minutes,
 * a practice block's fixed length its one item's).
 */
export function autoCheckInMinutes(
  block: PlanBlock,
  planDate: LocalDay,
  items: Readonly<Record<string, ItemState>>,
): number {
  let minutes = 0
  for (const item of block.items) {
    if (itemStudied(item.itemId, planDate, items)) minutes += item.minutes
  }
  return Math.ceil(minutes)
}

/** Rounds away float noise from a difference of fractional minutes (1.1 − 0.1 is not 1). */
const MINUTES_PRECISION = 1e6

/**
 * The minutes a one-tap check-in of `block` records and the sheet pre-fills (ruling M5-R39 #3):
 * the block's estimate less the minutes of its items the learner skipped for `planDate` — skipped
 * and not studied (`itemStudied`: a skip after a result on or after the plan date keeps the
 * result's minutes) — rounded up to whole minutes, never below 0. Nothing skipped, it is
 * `checkInMinutes(block)`; every item skipped, 0 — a valid `done` payload (0–600), as the sheet
 * allows. The auto check-in credits studied items only instead (`autoCheckInMinutes`).
 */
export function oneTapMinutes(
  block: PlanBlock,
  planDate: LocalDay,
  items: Readonly<Record<string, ItemState>>,
): number {
  let skipped = 0
  for (const item of block.items) {
    if (
      own(items, item.itemId)?.status === 'skipped' &&
      !itemStudied(item.itemId, planDate, items)
    ) {
      skipped += item.minutes
    }
  }
  const left = Math.round((block.estMinutes - skipped) * MINUTES_PRECISION) / MINUTES_PRECISION
  return Math.max(0, Math.ceil(left))
}

/** The plan's blocks that list `itemId`, in plan order. */
export function blocksWithItem(plan: StoredPlan, itemId: string): PlanBlock[] {
  return plan.blocks.filter((block) => block.items.some((item) => item.itemId === itemId))
}

/** The `extra` block's auto check-in no longer matches the block: items were added and studied
 *  since (its minutes follow its studied items, `autoCheckInMinutes`). A learner's own check-in
 *  (`auto: false`) is always kept. */
function staleExtraCheckIn(
  block: PlanBlock,
  checkIn: BlockState,
  planDate: LocalDay,
  items: Readonly<Record<string, ItemState>>,
): boolean {
  return (
    block.kind === 'extra' &&
    checkIn.auto &&
    checkIn.minutes !== autoCheckInMinutes(block, planDate, items)
  )
}

/**
 * Blocks of `plan` listing `itemId` whose items are all handled, at least one of them studied (a
 * skip is not a result, ruling M5-R36: a block whose items were all skipped is left to the
 * learner), and that have no check-in yet (§5.5) — a block checked in `skipped` included, which
 * only the learner's "Sửa" changes (M-6). The `extra` block also when its check-in is `auto` and
 * its minutes no longer equal `autoCheckInMinutes` (decision 15). In plan order.
 */
export function blocksToAutoCheckIn(
  plan: StoredPlan,
  blocks: Readonly<Record<string, BlockState>>,
  items: Readonly<Record<string, ItemState>>,
  itemId: string,
): PlanBlock[] {
  const { planDate } = plan
  return blocksWithItem(plan, itemId).filter((block) => {
    if (!block.items.every((item) => itemHandled(item.itemId, planDate, items))) return false
    if (!block.items.some((item) => itemStudied(item.itemId, planDate, items))) return false
    const checkIn = own(blocks, blockKey(plan.id, block.id))
    return checkIn === undefined || staleExtraCheckIn(block, checkIn, planDate, items)
  })
}
