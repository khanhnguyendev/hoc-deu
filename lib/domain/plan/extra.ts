/**
 * "Học thêm" and off-plan study (platform design §5.3, §5.5, §5.9; Part B-M5 decisions 20, 21):
 * which new items a tap of "Học thêm" appends to a track's `extra` block, the block after an
 * addition, and the mode an item studied off the plan is attached in. Pure — the server
 * (`lib/plans/extra.ts`) loads the plan and the context and stores the block through
 * `plan.extra_added`, which only lets it append.
 */
import type { ItemMode, PlanItem } from '../catalog'
import { own } from '../compare'
import type { ItemState } from '../state'
import type { LocalDay } from '../time/localDay'
import { reviewMode } from './reviewMode'
import { newQueue } from './roadmap'
import { planBlockId } from './template'
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

/** The track's `extra` block: `<date>:<track>:extra:1` (§5.4 step 8, decision 20). */
export function extraBlockId(planDate: LocalDay, trackId: string): string {
  return planBlockId(planDate, trackId, 'extra', 1)
}

/** The track's extra block in `plan`, if it has one. */
function extraBlockOf(plan: StoredPlan, trackId: string): PlanBlock | undefined {
  const id = extraBlockId(plan.planDate, trackId)
  return plan.blocks.find((block) => block.id === id)
}

/**
 * "Học thêm" (decision 20): the track's next not-introduced new items that are not in `plan`, in
 * queue order (`newQueue`, §5.3 — the enrollment's variant and `includeBonus`), at least one, then
 * while their minutes stay below EXTRA_MIN_MINUTES. None when the plan's snapshot for the track has
 * newPerDay 0 (throttled to zero, §5.5), for a track that is not an active enrollment of an active
 * catalog track, or when the queue is empty. Bounded by one addition (EXTRA_MAX_ITEMS) and by what
 * the stored extra block may hold (MAX_BLOCK_MINUTES, 500 items): the queue is read in order and
 * stops at the first item that no longer fits. Items are added in mode `new` with their new
 * minutes.
 */
export function extraCandidates(
  ctx: PlanContext,
  plan: StoredPlan,
  trackId: string,
): PlanBlockItem[] {
  if (own(plan.tracks, trackId)?.newPerDay === 0) return []
  const enrollment = ctx.enrollments.find(
    (candidate) => candidate.trackId === trackId && candidate.status === 'active',
  )
  const track = own(ctx.catalog.tracks, trackId)
  if (enrollment === undefined || track?.status !== 'active') return []

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
 * The track's extra block after appending `items` — created when the plan has none: the stored
 * block's items first (the same objects, in order, as `plan.extra_added` checks), then `items`;
 * `estMinutes` = the sum of all its items' minutes.
 */
export function withExtraItems(
  plan: StoredPlan,
  trackId: string,
  items: readonly PlanBlockItem[],
): PlanBlock {
  const existing = extraBlockOf(plan, trackId)
  const all = [...(existing?.items ?? []), ...items]
  return {
    id: extraBlockId(plan.planDate, trackId),
    trackId,
    kind: 'extra',
    estMinutes: all.reduce((sum, item) => sum + item.minutes, 0),
    items: all,
  }
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
