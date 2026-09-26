/**
 * The per-track internals of plan building (platform design §5.4, §5.5; Part B-M4 decisions 13–15):
 * a track's setup (steps 1–2), its running budget and placed items, review and new-item selection,
 * block numbering (step 9) and plan assembly. **Imported only by `buildPlan.ts` (today's plan) and
 * `resume.ts` (the stale-plan resume, §5.8)** — everything else uses those two modules' public
 * functions (M4 final review M-11: `buildPlan.ts` no longer exports its internals).
 */
import type { PlanRoadmap, PlanTemplateBlock, PlanTrack } from '../catalog'
import { compareIds, own } from '../compare'
import { weakTopics } from '../stats/weakTopics'
import { weekdayOf } from '../time/weekday'
import {
  type BudgetState,
  type Candidate,
  inReviewDebt,
  reviewCap,
  type Selection,
  selectHalfFit,
  selectSkipping,
  spend,
  startBudget,
} from './budget'
import { type DueEntry, dueQueue } from './queues'
import { newQueue, roadmapWeek } from './roadmap'
import { dayTemplate, planBlockId } from './template'
import { effectiveNewPerDay } from './throttle'
import type {
  BlockKind,
  DayPlan,
  Enrollment,
  PlanBlock,
  PlanBlockItem,
  PlanContext,
  PlanMode,
  TrackSnapshot,
} from './types'

/** An enrollment the plan includes, with its catalog track. */
export type TrackEntry = { readonly enrollment: Enrollment; readonly track: PlanTrack }

/** Steps 1–2: what every later step of a track reads. */
export type TrackSetup = {
  readonly ctx: PlanContext
  readonly enrollment: Enrollment
  readonly roadmap: PlanRoadmap | null
  readonly week: number
  /** The day's template blocks (`dayTemplate`). */
  readonly template: readonly PlanTemplateBlock[]
  readonly due: readonly DueEntry[]
  readonly debt: boolean
  /** The effective new-item cap (§5.5); null = no cap. */
  readonly newCap: number | null
  /** The track's new-item queue (§5.3), built on first use and then reused: every new-item
   *  selection of the plan reads the same queue (4.6 minor). */
  readonly newQueue: () => readonly string[]
}

/** The running state of a track's plan (step 9). */
export type Progress = {
  readonly budget: BudgetState
  /** The item IDs placed so far in this track. */
  readonly planned: ReadonlySet<string>
  /** SRS items placed as `new` so far — they count toward `newCap`. */
  readonly newSrs: number
  /** A new-item selection has run: only the first one may force its first item (§5.4 step 5). */
  readonly newStarted: boolean
}

/** A block before it is numbered (step 9). */
export type DraftBlock = {
  readonly kind: BlockKind
  readonly items: readonly PlanBlockItem[]
  /** Practice blocks: the fixed length, which is also their `estMinutes`. */
  readonly minutes?: number
  readonly tag?: string
  readonly itemType?: string
  readonly recapWeek?: number | null
  /** Shadowing blocks: the cards, filled in step 8. */
  readonly shadowing?: readonly string[]
}

/** What placing one block gives: its draft (null = dropped) and the track's state after it. */
export type Placed = { readonly draft: DraftBlock | null; readonly progress: Progress }

/** One track's blocks and snapshot (steps 1–9). */
export type TrackPlan = {
  readonly trackId: string
  readonly blocks: readonly PlanBlock[]
  readonly snapshot: TrackSnapshot
}

// ---------------------------------------------------------------------------------------------
// Steps 1–2
// ---------------------------------------------------------------------------------------------

/** Active enrollments that have started (`planDate ≥ startDate`) and whose track is active in the
 *  catalog, in `trackId` order. */
export function eligibleTracks(ctx: PlanContext): TrackEntry[] {
  return ctx.enrollments
    .filter(
      // LocalDay is a zero-padded `YYYY-MM-DD` string: string order is chronological order.
      (enrollment) => enrollment.status === 'active' && enrollment.startDate <= ctx.planDate,
    )
    .toSorted((a, b) => compareIds(a.trackId, b.trackId))
    .flatMap((enrollment) => {
      const track = ctx.catalog.tracks[enrollment.trackId]
      return track?.status === 'active' ? [{ enrollment, track }] : []
    })
}

/** Steps 1–2: the roadmap week, the day's template, weak topics, the due queue, review debt and
 *  the effective new-item cap; the new-item queue once a step asks for it. */
export function trackSetup(ctx: PlanContext, { enrollment, track }: TrackEntry): TrackSetup {
  const { trackId } = enrollment
  const roadmap = track.roadmaps[enrollment.variant] ?? null
  const week = roadmapWeek(roadmap, ctx.catalog, ctx.items)
  const weakTopicIds = new Set(
    weakTopics(ctx.items, ctx.catalog, new Set([trackId])).map((topic) => topic.topicId),
  )
  const due = dueQueue({
    trackId,
    items: ctx.items,
    catalog: ctx.catalog,
    today: ctx.planDate,
    weakTopicIds,
  })
  let queue: readonly string[] | undefined
  return {
    ctx,
    enrollment,
    roadmap,
    week,
    template: dayTemplate(enrollment.weeklyTemplate, weekdayOf(ctx.planDate), week),
    due,
    debt: inReviewDebt(due.map((entry) => entry.overdueDays)),
    newCap: effectiveNewPerDay(enrollment.newPerDay, enrollment.throttle, due.length),
    newQueue: () =>
      (queue ??= newQueue({
        trackId,
        roadmap,
        catalog: ctx.catalog,
        items: ctx.items,
        includeBonus: enrollment.includeBonus,
      })),
  }
}

export function startProgress(setup: TrackSetup): Progress {
  return {
    budget: startBudget(setup.enrollment.budgetMinutes),
    planned: new Set(),
    newSrs: 0,
    newStarted: false,
  }
}

/** The track's snapshot (`day_plans.roadmap_weeks`, decision 6). */
export function snapshotOf(setup: TrackSetup): TrackSnapshot {
  return {
    variant: setup.enrollment.variant,
    week: setup.week,
    dueCount: setup.due.length,
    newPerDay: setup.newCap,
    throttled: setup.newCap !== setup.enrollment.newPerDay,
    reviewDebt: setup.debt,
  }
}

// ---------------------------------------------------------------------------------------------
// Bookkeeping (step 9)
// ---------------------------------------------------------------------------------------------

/** Step 9's bookkeeping: spend the selection and record its items. */
export function take(setup: TrackSetup, progress: Progress, selection: Selection): Progress {
  const planned = new Set(progress.planned)
  let newSrs = progress.newSrs
  for (const picked of selection.picked) {
    planned.add(picked.itemId)
    if (picked.mode === 'new' && (setup.ctx.catalog.items[picked.itemId]?.srs ?? null) !== null) {
      newSrs += 1
    }
  }
  return { ...progress, budget: spend(progress.budget, selection), planned, newSrs }
}

/** The new-item cap left for this track today; null = no cap. */
export function newCapLeft(setup: TrackSetup, progress: Progress): number | null {
  return setup.newCap === null ? null : Math.max(0, setup.newCap - progress.newSrs)
}

/** The selection's items as plan block items. */
export function itemsOf(selection: Selection): PlanBlockItem[] {
  return selection.picked.map(({ itemId, mode, minutes, overBudget }) =>
    overBudget ? { itemId, mode, minutes, overBudget } : { itemId, mode, minutes },
  )
}

// ---------------------------------------------------------------------------------------------
// Step 4: review blocks
// ---------------------------------------------------------------------------------------------

/** A Weak entry's deep-dive lesson, placed right before it (§5.4 step 3): active, not introduced
 *  and not in the plan yet; otherwise null. */
function deepDiveLead(
  setup: TrackSetup,
  entry: DueEntry,
  planned: ReadonlySet<string>,
): Candidate | null {
  const { catalog, items } = setup.ctx
  if (!entry.state.weak || entry.item.deepDiveId === null) return null
  const lesson = catalog.items[entry.item.deepDiveId]
  if (lesson === undefined || lesson.status !== 'active') return null
  if (items[lesson.id] !== undefined || planned.has(lesson.id)) return null
  return { itemId: lesson.id, mode: 'new', minutes: lesson.minutes.new, srs: false }
}

/** The due entries not in the plan yet, each with its deep-dive lead when it has one (a lesson
 *  leads at most one unit). */
function reviewCandidates(setup: TrackSetup, planned: ReadonlySet<string>): Candidate[] {
  const leads = new Set<string>()
  return setup.due
    .filter((entry) => !planned.has(entry.itemId))
    .map((entry) => {
      const unit: Candidate = {
        itemId: entry.itemId,
        mode: entry.mode,
        minutes: entry.minutes,
        srs: true,
      }
      const lead = deepDiveLead(setup, entry, planned)
      if (lead === null || leads.has(lead.itemId)) return unit
      leads.add(lead.itemId)
      return { ...unit, lead }
    })
}

/** Step 4: a review block — due items within `reviewCap` (the block's `maxMinutes`, raised by
 *  review debt), skipping what does not fit. May come out empty (step 7 decides what then). */
export function placeReview(
  setup: TrackSetup,
  maxMinutes: number | undefined,
  progress: Progress,
): Placed {
  const cap = reviewCap({
    maxMinutes,
    trackBudget: setup.enrollment.budgetMinutes,
    remaining: progress.budget.remaining,
    debt: setup.debt,
  })
  const selection = selectSkipping(reviewCandidates(setup, progress.planned), { cap })
  return {
    draft: { kind: 'review', items: itemsOf(selection) },
    progress: take(setup, progress, selection),
  }
}

// ---------------------------------------------------------------------------------------------
// Step 6: new items
// ---------------------------------------------------------------------------------------------

/** The first new item is forced only in the track's first new selection, and only while the
 *  overshoot is unused (§5.4 step 5, decision 13). */
export function mayForceNew(progress: Progress): boolean {
  return !progress.newStarted && !progress.budget.overshootUsed
}

/** The candidates of `itemIds`, in order, that are in the catalog and not in the plan yet — one
 *  at a time, so a selection reads only as far into the queue as it takes (4.6 minor). */
function* newCandidates(
  setup: TrackSetup,
  itemIds: readonly string[],
  planned: ReadonlySet<string>,
): Generator<Candidate> {
  for (const itemId of itemIds) {
    const item = own(setup.ctx.catalog.items, itemId)
    if (item === undefined || planned.has(itemId)) continue
    yield { itemId, mode: 'new', minutes: item.minutes.new, srs: item.srs !== null }
  }
}

/** A new block from `itemIds` (in order, those not in the plan yet): take-first-then-half-fit
 *  under the new-item cap left today (§5.4 step 5). */
export function placeNewItems(
  setup: TrackSetup,
  itemIds: readonly string[],
  progress: Progress,
  forceFirst: boolean,
): Placed {
  const selection = selectHalfFit(newCandidates(setup, itemIds, progress.planned), {
    remaining: progress.budget.remaining,
    newCap: newCapLeft(setup, progress),
    forceFirst,
  })
  return {
    draft: { kind: 'new', items: itemsOf(selection) },
    progress: { ...take(setup, progress, selection), newStarted: true },
  }
}

// ---------------------------------------------------------------------------------------------
// Step 9 and the plan
// ---------------------------------------------------------------------------------------------

/** A block with no item (and, for shadowing, no card) is left out (decision 14). */
function isKept(draft: DraftBlock | null): draft is DraftBlock {
  return draft !== null && (draft.items.length > 0 || (draft.shadowing?.length ?? 0) > 0)
}

/** Step 9: the kept drafts in order, numbered per kind; `estMinutes` = the sum of the items'
 *  minutes, a practice block's fixed minutes. */
export function emitBlocks(setup: TrackSetup, drafts: readonly (DraftBlock | null)[]): PlanBlock[] {
  const { ctx, enrollment } = setup
  const counts = new Map<BlockKind, number>()
  return drafts.filter(isKept).map((draft) => {
    const n = (counts.get(draft.kind) ?? 0) + 1
    counts.set(draft.kind, n)
    return {
      id: planBlockId(ctx.planDate, enrollment.trackId, draft.kind, n),
      trackId: enrollment.trackId,
      kind: draft.kind,
      estMinutes: draft.minutes ?? draft.items.reduce((sum, planned) => sum + planned.minutes, 0),
      items: [...draft.items],
      ...(draft.tag !== undefined && { tag: draft.tag }),
      ...(draft.itemType !== undefined && { itemType: draft.itemType }),
      ...(draft.recapWeek !== undefined && { recapWeek: draft.recapWeek }),
      ...(draft.shadowing !== undefined && { shadowing: [...draft.shadowing] }),
    }
  })
}

/** The plan of `tracks` (already in `trackId` order). */
export function assemblePlan(
  ctx: PlanContext,
  mode: PlanMode,
  tracks: readonly TrackPlan[],
): DayPlan {
  return {
    planDate: ctx.planDate,
    mode,
    blocks: tracks.flatMap((track) => track.blocks),
    tracks: Object.fromEntries(tracks.map((track) => [track.trackId, track.snapshot])),
  }
}
