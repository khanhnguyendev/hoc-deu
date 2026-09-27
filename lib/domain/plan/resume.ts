/**
 * Stale-plan resume, "Học tiếp hôm nay" (platform design §5.8; Part B-M4 decision 25, RF-5): when
 * the gate is closed and the last seen plan is old (`gateStatus().offerResume`, `gate.ts`), M5 builds
 * today's plan from the stale plan's unfinished new items and today's due reviews — so the roadmap
 * pointer never advances past the stale plan. The per-track rules are `buildPlan.ts`'s, shared
 * through `track.ts`.
 */
import type { PlanTemplateBlock } from '../catalog'
import {
  assemblePlan,
  eligibleTracks,
  emitBlocks,
  mayForceNew,
  placeNewItems,
  placeReview,
  snapshotOf,
  startProgress,
  type TrackEntry,
  type TrackPlan,
  trackSetup,
} from './track'
import type { DayPlan, PlanContext, StoredPlan } from './types'

type ReviewTemplateBlock = Extract<PlanTemplateBlock, { kind: 'review' }>

/** The items of the stale plan's `new` blocks of `trackId`, in order, that are active and not
 *  introduced now (each once). */
function staleNewItems(ctx: PlanContext, stale: StoredPlan, trackId: string): string[] {
  const itemIds = stale.blocks
    .filter((block) => block.trackId === trackId && block.kind === 'new')
    .flatMap((block) => block.items.map((planned) => planned.itemId))
  return [...new Set(itemIds)].filter((itemId) => {
    const item = ctx.catalog.items[itemId]
    return (
      item !== undefined &&
      item.trackId === trackId &&
      item.status === 'active' &&
      ctx.items[itemId] === undefined
    )
  })
}

/** One track: a review block capped by today's template's first review block (and review debt),
 *  then a new block of the stale plan's not-yet-introduced new items under today's throttle,
 *  first-item and half-fit rules. No practice, recap, fallback or spill. */
function resumeTrack(ctx: PlanContext, entry: TrackEntry, stale: StoredPlan): TrackPlan {
  const setup = trackSetup(ctx, entry)
  const { trackId } = entry.enrollment
  const firstReview = setup.template.find(
    (block): block is ReviewTemplateBlock => block.kind === 'review',
  )
  const review = placeReview(setup, firstReview?.maxMinutes, startProgress(setup))
  const added = placeNewItems(
    setup,
    staleNewItems(ctx, stale, trackId),
    review.progress,
    mayForceNew(review.progress),
  )
  return {
    trackId,
    blocks: emitBlocks(setup, [review.draft, added.draft]),
    snapshot: snapshotOf(setup),
  }
}

/** "Học tiếp hôm nay" (§5.8, decision 25): mode 'resume'. */
export function buildResumePlan(ctx: PlanContext, stale: StoredPlan): DayPlan {
  return assemblePlan(
    ctx,
    'resume',
    eligibleTracks(ctx).map((entry) => resumeTrack(ctx, entry, stale)),
  )
}
