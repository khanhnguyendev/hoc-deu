/**
 * "Học thêm" and off-plan study (platform design §5.3, §5.5, §5.9; Part B-M5 decisions 20, 21):
 * which new items a tap of "Học thêm" appends to a track's `extra` block, the block after an
 * addition, when off-plan study needs a fresh extra block (ruling M5-R36, M-3), and the mode an
 * item studied off the plan is attached in. Pure — the server (`lib/plans/extra.ts`) loads the
 * plan and the context and stores the block through `plan.extra_added`, which only lets it append
 * to one of the track's extra blocks or add the next one.
 */
import type { ItemMode, PlanItem } from '../catalog'
import { own } from '../compare'
import { blockKey, type BlockState, type ItemState } from '../state'
import type { LocalDay } from '../time/localDay'
import { itemHandled } from './checkin'
import { reviewMode } from './reviewMode'
import { newQueue } from './roadmap'
import { planBlockId } from './template'
import { eligibleTracks } from './track'
import {
  MAX_BLOCK_MINUTES,
  type PlanBlock,
  type PlanBlockItem,
  type PlanContext,
  type StoredPlan,
} from './types'

/** "Học thêm" adds new items until their minutes reach this (decision 20). */
export const EXTRA_MIN_MINUTES = 10
/** The most items one `plan.extra_added` appends — the SQL bound (ruling M5-R2,
 *  `EXTRA_ITEM_IDS.max` in `lib/events/plans.ts`). */
export const EXTRA_MAX_ITEMS = 20
/** `planBlockSchema`'s bound on a block's items. */
const MAX_BLOCK_ITEMS = 500

/** The track's `extra` block `n`: `<date>:<track>:extra:<n>` (§5.4 step 8, decision 20). A plan
 *  holds `extra:1`; `extra:2`, … only follow it as fresh blocks (ruling M5-R36, M-3). */
export function extraBlockId(planDate: LocalDay, trackId: string, n = 1): string {
  return planBlockId(planDate, trackId, 'extra', n)
}

/** The track's extra blocks in `plan`, in number order: `extra:1`, `extra:2`, … while each exists. */
function extraBlocksOf(plan: StoredPlan, trackId: string): PlanBlock[] {
  const found: PlanBlock[] = []
  for (;;) {
    const id = extraBlockId(plan.planDate, trackId, found.length + 1)
    const next = plan.blocks.find((block) => block.id === id)
    if (next === undefined) return found
    found.push(next)
  }
}

/** The track's latest extra block in `plan` — the one "Học thêm" and off-plan study append to —
 *  if it has one. */
export function extraBlockOf(plan: StoredPlan, trackId: string): PlanBlock | undefined {
  return extraBlocksOf(plan, trackId).at(-1)
}

/**
 * The tracks "Học thêm" is offered for on `ctx.planDate` (decision 20): the plan engine's own
 * eligibility (`eligibleTracks` — an active enrollment that has started, of an active catalog
 * track), in `trackId` order. `/today` offers the button exactly for these (ruling M5-R33 M-4),
 * and `extraCandidates` adds nothing for any other track.
 */
export function extraTrackIds(
  ctx: Pick<PlanContext, 'planDate' | 'catalog' | 'enrollments'>,
): string[] {
  return eligibleTracks(ctx).map((entry) => entry.enrollment.trackId)
}

/**
 * "Học thêm" (decision 20): the track's next not-introduced new items that are not in `plan`, in
 * queue order (`newQueue`, §5.3 — the enrollment's variant and `includeBonus`), at least one, then
 * while their minutes stay below EXTRA_MIN_MINUTES. None when the plan's snapshot for the track has
 * newPerDay 0 (throttled to zero, §5.5), for a track `extraTrackIds` leaves out (the engine's
 * eligibility on `ctx.planDate`), or when the queue is empty. Bounded by one addition
 * (EXTRA_MAX_ITEMS) and by what the stored extra block may hold (MAX_BLOCK_MINUTES, 500 items): the
 * queue is read in order and stops at the first item that no longer fits. Items are added in mode
 * `new` with their new minutes.
 */
export function extraCandidates(
  ctx: PlanContext,
  plan: StoredPlan,
  trackId: string,
): PlanBlockItem[] {
  if (own(plan.tracks, trackId)?.newPerDay === 0) return []
  const entry = eligibleTracks(ctx).find((candidate) => candidate.enrollment.trackId === trackId)
  if (entry === undefined) return []
  const { enrollment, track } = entry

  const queue = newQueue({
    trackId,
    roadmap: own(track.roadmaps, enrollment.variant) ?? null,
    catalog: ctx.catalog,
    items: ctx.items,
    includeBonus: enrollment.includeBonus,
  })
  const planned = new Set(plan.blocks.flatMap((block) => block.items.map((item) => item.itemId)))
  const extra = extraBlockOf(plan, trackId)
  const roomMinutes = MAX_BLOCK_MINUTES - (extra?.estMinutes ?? 0)
  const roomItems = Math.min(EXTRA_MAX_ITEMS, MAX_BLOCK_ITEMS - (extra?.items.length ?? 0))

  const picked: PlanBlockItem[] = []
  let minutes = 0
  for (const itemId of queue) {
    if (picked.length > 0 && minutes >= EXTRA_MIN_MINUTES) break
    if (picked.length >= roomItems) break
    const item = own(ctx.catalog.items, itemId)
    if (item === undefined || planned.has(itemId)) continue
    if (minutes + item.minutes.new > roomMinutes) break
    picked.push({ itemId, mode: 'new', minutes: item.minutes.new })
    minutes += item.minutes.new
  }
  return picked
}

/**
 * The track's latest extra block after appending `items` — created (`extra:1`) when the plan has
 * none: the stored block's items first (the same objects, in order, as `plan.extra_added`
 * checks), then `items`; `estMinutes` = the sum of all its items' minutes. With `fresh`, a new
 * extra block numbered after the latest one, holding `items` only (`freshExtraBlockNeeded`).
 */
export function withExtraItems(
  plan: StoredPlan,
  trackId: string,
  items: readonly PlanBlockItem[],
  options: { readonly fresh?: boolean } = {},
): PlanBlock {
  const existing = extraBlocksOf(plan, trackId)
  const latest = options.fresh === true ? undefined : existing.at(-1)
  const n = latest === undefined ? existing.length + 1 : existing.length
  const all = [...(latest?.items ?? []), ...items]
  return {
    id: extraBlockId(plan.planDate, trackId, n),
    trackId,
    kind: 'extra',
    estMinutes: all.reduce((sum, item) => sum + item.minutes, 0),
    items: all,
  }
}

/**
 * Off-plan study of a track the paused view hides (ruling M5-R36, M-3): whether the item goes to
 * a fresh extra block instead of the track's latest one. The caller asks only on the paused plan
 * and for a track that is not active — its blocks are left out of the paused view
 * (`unfinishedBlocks`, M-5 A), so the learner cannot check them in and the study must count by
 * itself. True when that extra block would not be checked in after the item's result: it holds an
 * item not handled for the plan date (`itemHandled`), or it carries the learner's own check-in (a
 * skip — the auto check-in never replaces it, M-6). False without an extra block (the attachment
 * creates `extra:1`).
 */
export function freshExtraBlockNeeded(
  plan: StoredPlan,
  trackId: string,
  blocks: Readonly<Record<string, BlockState>>,
  items: Readonly<Record<string, ItemState>>,
): boolean {
  const extra = extraBlockOf(plan, trackId)
  if (extra === undefined) return false
  const checkIn = own(blocks, blockKey(plan.id, extra.id))
  if (checkIn !== undefined && !checkIn.auto) return true
  return !extra.items.every((item) => itemHandled(item.itemId, plan.planDate, items))
}

/**
 * The mode an item studied off the plan is attached in (decision 21): the result's own `recall` /
 * `redo` for an item with review modes (a problem); else `new` before its first result, and its
 * review mode (`reviewMode`) once introduced — `state` is the item's state before the result.
 */
export function offPlanMode(
  item: PlanItem,
  state: ItemState | undefined,
  requested?: ItemMode,
): ItemMode {
  if (item.reviewModes && (requested === 'recall' || requested === 'redo')) return requested
  return state === undefined ? 'new' : reviewMode(item, state)
}
