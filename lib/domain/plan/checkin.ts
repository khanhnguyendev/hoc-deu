/**
 * The check-in rules a result needs (platform design §5.5; Part B-M5 decisions 14 and 15): whether
 * an item is handled for a plan, which of the plan's blocks list it, and which blocks the server
 * checks in automatically after the result. Pure: the caller loads the plan, its block states and
 * the item states, and decides this inside each retry attempt, on the rows it just reloaded — so a
 * block the learner checked in meanwhile (the sheet racing the auto check-in) is left alone.
 */
import { own } from '../compare'
import { blockKey, type BlockState, type ItemState } from '../state'
import type { LocalDay } from '../time/localDay'
import { checkInMinutes } from './buildPlan'
import type { PlanBlock, StoredPlan } from './types'

/** Handled for a plan dated `planDate` (decision 15): a result on or after that day, or skipped. */
export function itemHandled(
  itemId: string,
  planDate: LocalDay,
  items: Readonly<Record<string, ItemState>>,
): boolean {
  const state = own(items, itemId)
  if (state === undefined) return false
  if (state.status === 'skipped') return true
  // LocalDay is a zero-padded `YYYY-MM-DD` string: string order is chronological order.
  return state.lastResultOn !== null && state.lastResultOn >= planDate
}

/** The plan's blocks that list `itemId`, in plan order. */
export function blocksWithItem(plan: StoredPlan, itemId: string): PlanBlock[] {
  return plan.blocks.filter((block) => block.items.some((item) => item.itemId === itemId))
}

/** The `extra` block's auto check-in no longer matches the block: items were added since (its
 *  minutes follow its items). A learner's own check-in (`auto: false`) is always kept. */
function staleExtraCheckIn(block: PlanBlock, checkIn: BlockState): boolean {
  return block.kind === 'extra' && checkIn.auto && checkIn.minutes !== checkInMinutes(block)
}

/**
 * Blocks of `plan` listing `itemId` whose items are all handled and that have no check-in yet
 * (§5.5) — a block checked in `skipped` included, which only the learner's "Sửa" changes (M-6).
 * The `extra` block also when its check-in is `auto` and its minutes no longer equal
 * checkInMinutes(block) (decision 15). In plan order.
 */
export function blocksToAutoCheckIn(
  plan: StoredPlan,
  blocks: Readonly<Record<string, BlockState>>,
  items: Readonly<Record<string, ItemState>>,
  itemId: string,
): PlanBlock[] {
  return blocksWithItem(plan, itemId).filter((block) => {
    if (!block.items.every((item) => itemHandled(item.itemId, plan.planDate, items))) return false
    const checkIn = own(blocks, blockKey(plan.id, block.id))
    return checkIn === undefined || staleExtraCheckIn(block, checkIn)
  })
}
