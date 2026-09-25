/**
 * Today's plan (platform design §5.4, §5.5, §5.6; Part B-M4 decisions 7, 13–15, 26): for each
 * active track, the day's template filled from the due queue, the recap source and the new-item
 * queue within the track's budget. Pure — M5's `ensurePlan` loads the context and applies the gate
 * (`gate.ts`) first; `resume.ts` builds the stale-plan resume from the per-track helpers exported
 * here.
 *
 * Per track (in `trackId` order): step 1–2 `trackSetup`; then, in this order, practice blocks
 * (step 3), review blocks (4), recap blocks (5), new blocks (6), the fallbacks and the spill of a
 * day without a `new` block (7), shadowing cards (8), and numbering (9). Every step spends the
 * track's budget (`spend`) and records the items it placed, so no item is placed twice and the
 * track's one overshoot (decision 13) is used at most once.
 */
import type { PlanRoadmap, PlanTemplateBlock, PlanTrack } from '../catalog'
import { weakTopics } from '../stats/weakTopics'
import { weekdayOf } from '../time/weekday'
import {
  type BudgetState,
  type Candidate,
  inReviewDebt,
  reserveFixed,
  reviewCap,
  type Selection,
  selectHalfFit,
  selectSkipping,
  spend,
  startBudget,
} from './budget'
import { pickByItemType, pickByTag, pickShadowing, SHADOWING_TAG } from './practice'
import { type DueEntry, dueQueue } from './queues'
import { newQueue, recapCandidates, recapSource, roadmapWeek } from './roadmap'
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

type TemplateBlockOf<K extends PlanTemplateBlock['kind']> = Extract<PlanTemplateBlock, { kind: K }>

/** A day without a `new` block falls back from an empty review block to this many filler recap
 *  items (§5.4 step 7). */
const FILLER_RECAP_COUNT = 3

const NO_WEEKS: ReadonlySet<number> = new Set()

const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

// ---------------------------------------------------------------------------------------------
// Shared per-track state (also used by resume.ts)
// ---------------------------------------------------------------------------------------------

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

/** Active enrollments that have started (`planDate ≥ startDate`) and whose track is active in the
 *  catalog, in `trackId` order. */
export function eligibleTracks(ctx: PlanContext): TrackEntry[] {
  return ctx.enrollments
    .filter(
      // LocalDay is a zero-padded `YYYY-MM-DD` string: string order is chronological order.
      (enrollment) => enrollment.status === 'active' && enrollment.startDate <= ctx.planDate,
    )
    .toSorted((a, b) => compare(a.trackId, b.trackId))
    .flatMap((enrollment) => {
      const track = ctx.catalog.tracks[enrollment.trackId]
      return track?.status === 'active' ? [{ enrollment, track }] : []
    })
}

/** Steps 1–2: the roadmap week, the day's template, weak topics, the due queue, review debt and
 *  the effective new-item cap. */
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
  return {
    ctx,
    enrollment,
    roadmap,
    week,
    template: dayTemplate(enrollment.weeklyTemplate, weekdayOf(ctx.planDate), week),
    due,
    debt: inReviewDebt(due.map((entry) => entry.overdueDays)),
    newCap: effectiveNewPerDay(enrollment.newPerDay, enrollment.throttle, due.length),
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

/** Step 9's bookkeeping: spend the selection and record its items. */
function take(setup: TrackSetup, progress: Progress, selection: Selection): Progress {
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
function newCapLeft(setup: TrackSetup, progress: Progress): number | null {
  return setup.newCap === null ? null : Math.max(0, setup.newCap - progress.newSrs)
}

/** The selection's items as plan block items. */
function itemsOf(selection: Selection): PlanBlockItem[] {
  return selection.picked.map(({ itemId, mode, minutes, overBudget }) =>
    overBudget ? { itemId, mode, minutes, overBudget } : { itemId, mode, minutes },
  )
}

// ---------------------------------------------------------------------------------------------
// Step 3: practice blocks
// ---------------------------------------------------------------------------------------------

/** The practice block's item: by `itemType`, else by `tag`; null when none, when it is already in
 *  the plan (a template may repeat a block), or when it is a new SRS item (not introduced) and the
 *  track's new-item cap is used up — a custom template's `itemType: 'flashcard'` block spends the
 *  cap like a new block (§5.4 throttle; `take` counts it). */
function practicePick(
  setup: TrackSetup,
  block: TemplateBlockOf<'practice'>,
  progress: Progress,
): string | null {
  const { ctx, enrollment, week } = setup
  const input = {
    trackId: enrollment.trackId,
    roadmapWeek: week,
    items: ctx.items,
    catalog: ctx.catalog,
  }
  const pick =
    block.itemType !== undefined
      ? pickByItemType({ ...input, itemType: block.itemType })
      : block.tag !== undefined
        ? pickByTag({ ...input, tag: block.tag })
        : null
  if (pick === null || progress.planned.has(pick)) return null
  const newSrs = ctx.items[pick] === undefined && (ctx.catalog.items[pick]?.srs ?? null) !== null
  return newSrs && newCapLeft(setup, progress) === 0 ? null : pick
}

/** Step 3: a practice block — its item, or for the shadowing tag the cards step 8 fills; dropped
 *  when it finds nothing (before reserving, decision 14) or when its minutes cannot be reserved
 *  (`reserveFixed`: over the remaining budget with the overshoot used, decision 13). */
function placePractice(
  setup: TrackSetup,
  block: TemplateBlockOf<'practice'>,
  progress: Progress,
): Placed {
  const itemId = practicePick(setup, block, progress)
  const shadowing = itemId === null && block.tag === SHADOWING_TAG
  if (itemId === null && !shadowing) return { draft: null, progress }

  const reserve = reserveFixed(progress.budget, block.minutes)
  if (!reserve.take) return { draft: null, progress }

  const items: PlanBlockItem[] =
    itemId === null
      ? []
      : [
          {
            itemId,
            mode: setup.ctx.items[itemId] === undefined ? 'new' : 'review',
            minutes: block.minutes,
          },
        ]
  return {
    draft: {
      kind: 'practice',
      items,
      minutes: block.minutes,
      ...(block.tag !== undefined && { tag: block.tag }),
      ...(block.itemType !== undefined && { itemType: block.itemType }),
      ...(shadowing && { shadowing: [] }),
    },
    progress: take(setup, progress, {
      picked: items,
      minutes: block.minutes,
      overshoot: reserve.overshoot,
    }),
  }
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
// Step 5: recap blocks
// ---------------------------------------------------------------------------------------------

/** The items the roadmap's recap list of `week` names with a mode (§5.6). */
function recapEntryIds(roadmap: PlanRoadmap | null, week: number): ReadonlySet<string> {
  const entries = roadmap?.weeks.find((candidate) => candidate.week === week)?.recap ?? []
  return new Set(entries.filter((entry) => entry.mode !== undefined).map((entry) => entry.item))
}

/** A recap block of `week`'s recap (null = filler only, §5.6): up to `count` items, skipping what
 *  does not fit the remaining budget, the first forced while the overshoot is unused. Its
 *  `recapWeek` is `week` when it holds one of that week's recap entries, else null. */
function recapBlock(
  setup: TrackSetup,
  week: number | null,
  count: number,
  progress: Progress,
): Placed & { readonly draft: DraftBlock } {
  const { ctx, enrollment, roadmap } = setup
  const picks = recapCandidates({
    trackId: enrollment.trackId,
    roadmap,
    week,
    catalog: ctx.catalog,
    items: ctx.items,
    count,
    exclude: progress.planned,
  })
  const candidates = picks.flatMap((pick): Candidate[] => {
    const item = ctx.catalog.items[pick.itemId]
    return item === undefined
      ? []
      : [{ itemId: pick.itemId, mode: pick.mode, minutes: item.minutes[pick.mode], srs: false }]
  })
  const selection = selectSkipping(candidates, {
    cap: progress.budget.remaining,
    maxUnits: count,
    forceFirst: !progress.budget.overshootUsed,
  })
  const items = itemsOf(selection)
  const entries = week === null ? null : recapEntryIds(roadmap, week)
  const fromWeek = entries !== null && items.some((planned) => entries.has(planned.itemId))
  return {
    draft: { kind: 'recap', items, recapWeek: fromWeek ? week : null },
    progress: take(setup, progress, selection),
  }
}

/** Step 5: a recap block — the recap of `recapSource` (the latest ready week not done yet), then
 *  filler. */
function placeRecap(setup: TrackSetup, count: number, progress: Progress): Placed {
  const { ctx, enrollment, roadmap, week } = setup
  const source = recapSource({
    roadmap,
    catalog: ctx.catalog,
    items: ctx.items,
    done: ctx.recapDone[enrollment.trackId] ?? NO_WEEKS,
    currentWeek: week,
  })
  return recapBlock(setup, source, count, progress)
}

// ---------------------------------------------------------------------------------------------
// Step 6: new blocks
// ---------------------------------------------------------------------------------------------

/** The first new item is forced only in the track's first new selection, and only while the
 *  overshoot is unused (§5.4 step 5, decision 13). */
export function mayForceNew(progress: Progress): boolean {
  return !progress.newStarted && !progress.budget.overshootUsed
}

/** The track's new-item queue (§5.3). */
function queueOf(setup: TrackSetup): string[] {
  const { ctx, enrollment, roadmap } = setup
  return newQueue({
    trackId: enrollment.trackId,
    roadmap,
    catalog: ctx.catalog,
    items: ctx.items,
    includeBonus: enrollment.includeBonus,
  })
}

/** A new block from `itemIds` (in order, those not in the plan yet): take-first-then-half-fit
 *  under the new-item cap left today (§5.4 step 5). */
export function placeNewItems(
  setup: TrackSetup,
  itemIds: readonly string[],
  progress: Progress,
  forceFirst: boolean,
): Placed {
  const candidates = itemIds.flatMap((itemId): Candidate[] => {
    const item = setup.ctx.catalog.items[itemId]
    if (item === undefined || progress.planned.has(itemId)) return []
    return [{ itemId, mode: 'new', minutes: item.minutes.new, srs: item.srs !== null }]
  })
  const selection = selectHalfFit(candidates, {
    remaining: progress.budget.remaining,
    newCap: newCapLeft(setup, progress),
    forceFirst,
  })
  return {
    draft: { kind: 'new', items: itemsOf(selection) },
    progress: { ...take(setup, progress, selection), newStarted: true },
  }
}

/** Step 6: a new block from the new-item queue. */
function placeNew(setup: TrackSetup, progress: Progress): Placed {
  return placeNewItems(setup, queueOf(setup), progress, mayForceNew(progress))
}

// ---------------------------------------------------------------------------------------------
// Steps 3–9 over the day's template
// ---------------------------------------------------------------------------------------------

/** The track's blocks in template order (null = dropped), the spill block, and the state. */
type TrackState = {
  readonly progress: Progress
  readonly slots: readonly (DraftBlock | null)[]
  readonly spill: DraftBlock | null
}

function withSlot(state: TrackState, index: number, placed: Placed): TrackState {
  return { ...state, progress: placed.progress, slots: state.slots.with(index, placed.draft) }
}

/** Step 3, in template order. */
function placePracticeBlocks(setup: TrackSetup, state: TrackState): TrackState {
  return setup.template.reduce(
    (next, block, index) =>
      block.kind === 'practice'
        ? withSlot(next, index, placePractice(setup, block, next.progress))
        : next,
    state,
  )
}

/** Step 4, in template order. */
function placeReviewBlocks(setup: TrackSetup, state: TrackState): TrackState {
  return setup.template.reduce(
    (next, block, index) =>
      block.kind === 'review'
        ? withSlot(next, index, placeReview(setup, block.maxMinutes, next.progress))
        : next,
    state,
  )
}

/** Step 5, in template order. */
function placeRecapBlocks(setup: TrackSetup, state: TrackState): TrackState {
  return setup.template.reduce(
    (next, block, index) =>
      block.kind === 'recap'
        ? withSlot(next, index, placeRecap(setup, block.count, next.progress))
        : next,
    state,
  )
}

/** Step 6, in template order. */
function placeNewBlocks(setup: TrackSetup, state: TrackState): TrackState {
  return setup.template.reduce(
    (next, block, index) =>
      block.kind === 'new' ? withSlot(next, index, placeNew(setup, next.progress)) : next,
    state,
  )
}

const isEmptyDraft = (draft: DraftBlock | null): boolean =>
  draft !== null && draft.items.length === 0

/** An empty review block → a filler recap → new items; an empty recap block → new items. */
function placeFallback(setup: TrackSetup, kind: 'review' | 'recap', progress: Progress): Placed {
  if (kind === 'review') {
    const filler = recapBlock(setup, null, FILLER_RECAP_COUNT, progress)
    if (filler.draft.items.length > 0) return filler
  }
  return placeNewItems(setup, queueOf(setup), progress, mayForceNew(progress))
}

/** Step 7 (only on a day whose template has no `new` block): empty review and recap blocks fall
 *  back in template order, each taking its block's place (RF-4). */
function placeFallbacks(setup: TrackSetup, state: TrackState): TrackState {
  if (setup.template.some((block) => block.kind === 'new')) return state
  return setup.template.reduce((next, block, index) => {
    if (block.kind !== 'review' && block.kind !== 'recap') return next
    if (!isEmptyDraft(next.slots[index] ?? null)) return next
    return withSlot(next, index, placeFallback(setup, block.kind, next.progress))
  }, state)
}

/** Step 7, last (decision 26): on a day whose template has neither a `new` nor a `recap` block,
 *  and no fallback gave a new block, the leftover budget spills into new items — half-fit, never
 *  forced. */
function placeSpill(setup: TrackSetup, state: TrackState): TrackState {
  const hasNewOrRecap = setup.template.some(
    (block) => block.kind === 'new' || block.kind === 'recap',
  )
  const fellBackToNew = state.slots.some((draft) => draft?.kind === 'new' && draft.items.length > 0)
  if (hasNewOrRecap || fellBackToNew) return state
  const placed = placeNewItems(setup, queueOf(setup), state.progress, false)
  return { ...state, progress: placed.progress, spill: placed.draft }
}

/** Step 8: shadowing blocks read the example sentences of this track's new-block items (plan
 *  order), or of its most recently introduced cards (§5.6); a block that finds none is dropped
 *  in step 9 — its reserved minutes stay unused. */
function fillShadowing(
  setup: TrackSetup,
  drafts: readonly (DraftBlock | null)[],
): (DraftBlock | null)[] {
  const { ctx, enrollment } = setup
  const todaysNew = drafts.flatMap((draft) =>
    draft?.kind === 'new' ? draft.items.map((planned) => planned.itemId) : [],
  )
  return drafts.map((draft) =>
    draft?.shadowing === undefined
      ? draft
      : {
          ...draft,
          shadowing: pickShadowing({
            trackId: enrollment.trackId,
            todaysNew,
            items: ctx.items,
            catalog: ctx.catalog,
          }),
        },
  )
}

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

/** One track's blocks and snapshot (steps 1–9). */
export type TrackPlan = {
  readonly trackId: string
  readonly blocks: readonly PlanBlock[]
  readonly snapshot: TrackSnapshot
}

/** Steps 1–9 for one track: its blocks in template order (a fallback in its block's place, the
 *  spill last) and its snapshot. */
function buildTrack(ctx: PlanContext, entry: TrackEntry): TrackPlan {
  const setup = trackSetup(ctx, entry)
  const steps = [
    placePracticeBlocks,
    placeReviewBlocks,
    placeRecapBlocks,
    placeNewBlocks,
    placeFallbacks,
    placeSpill,
  ]
  const initial: TrackState = {
    progress: startProgress(setup),
    slots: setup.template.map(() => null),
    spill: null,
  }
  const final = steps.reduce((state, step) => step(setup, state), initial)
  const drafts = fillShadowing(setup, [...final.slots, final.spill])
  return {
    trackId: entry.enrollment.trackId,
    blocks: emitBlocks(setup, drafts),
    snapshot: snapshotOf(setup),
  }
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

// ---------------------------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------------------------

/** Today's baseline plan (§5.4): every eligible track's blocks, in `trackId` order, and its
 *  snapshot. Deterministic; never modifies `ctx`. */
export function buildPlan(ctx: PlanContext): DayPlan {
  return assemblePlan(
    ctx,
    'baseline',
    eligibleTracks(ctx).map((entry) => buildTrack(ctx, entry)),
  )
}

/** Sum of the track's blocks' estMinutes. */
export function plannedMinutes(plan: Pick<DayPlan, 'blocks'>, trackId: string): number {
  return plan.blocks
    .filter((block) => block.trackId === trackId)
    .reduce((sum, block) => sum + block.estMinutes, 0)
}

/** The largest single item of the track: the max over item minutes and practice-block minutes. */
export function largestItemMinutes(plan: Pick<DayPlan, 'blocks'>, trackId: string): number {
  return plan.blocks
    .filter((block) => block.trackId === trackId)
    .flatMap((block) => [
      ...(block.kind === 'practice' ? [block.estMinutes] : []),
      ...block.items.map((planned) => planned.minutes),
    ])
    .reduce((largest, minutes) => Math.max(largest, minutes), 0)
}

/** The minutes a one-tap or auto check-in pre-fills (decision 34): Math.ceil(block.estMinutes),
 *  so any non-empty block gives at least 1 (`block.checked_in.minutes` is an integer). */
export function checkInMinutes(block: PlanBlock): number {
  return Math.ceil(block.estMinutes)
}
