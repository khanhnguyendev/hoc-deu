/**
 * The plan simulation (platform design §5.10; Part B-M4 decisions 20, 21, 32): the real engine run
 * day by day for a synthetic learner — `gateStatus` → `buildPlan` → the learner's results as
 * events folded with `projectChanges` — so the §5.10 thresholds and the §5.11 projection table
 * measure the code learners use, not a model of it. Pure and deterministic for a seed: the learner
 * draws from `mulberry32(seed)`, dates come from `startDate`, nothing reads a clock.
 *
 * The fold is a batch fold (M4 final review M-8): one working copy of the derived state, which
 * only `simulate` holds, takes each event's rows in place (`applyChangesInPlace`) instead of
 * copying the whole state per event. An event the engine ignores throws (4.8 minor): a simulation
 * that feeds the engine events it ignores measures nothing.
 */
import { isActiveItem, type PlanCatalog, type PlanRoadmap, type Weekday } from '../catalog'
import { compareIds, own } from '../compare'
import type { EventType } from '../events'
import {
  applyChangesInPlace,
  type DomainEvent,
  mutableCopy,
  projectChanges,
} from '../projection/project'
import { mulberry32 } from '../random'
import { RULES_VERSION } from '../rules'
import type { Outcome } from '../srs/outcomes'
import { EMPTY_DERIVED_STATE, type ItemState } from '../state'
import { addDays, type LocalDay } from '../time/localDay'
import { buildPlan, checkInMinutes, largestItemMinutes, plannedMinutes } from './buildPlan'
import { gateStatus, unfinishedBlocks } from './gate'
import { recapWeeksDone } from './history'
import {
  EXTRA_WEEK_TAG,
  type ExtraWeekOverride,
  type InsertBlockOverride,
  OVERRIDE_LIMITS,
  type RoadmapOverride,
  TOPIC_PRACTICE_TAG,
  validateOverride,
} from './overrides'
import { dueQueue } from './queues'
import { coreItemsOfWeek, roadmapWeek } from './roadmap'
import type { Enrollment, PlanBlock, StoredPlan } from './types'

// ---------------------------------------------------------------------------------------------
// Percentiles
// ---------------------------------------------------------------------------------------------

/** Linear interpolation between order statistics (the prototype's `pct`), rounded to 0.1. */
export function percentile(values: readonly number[], q: number): number {
  if (values.length === 0) throw new Error('percentile: no values')
  const sorted = values.toSorted((a, b) => a - b)
  const k = (sorted.length - 1) * q
  const lowerIndex = Math.floor(k)
  const lower = sorted[lowerIndex] ?? Number.NaN
  const upper = sorted[Math.min(lowerIndex + 1, sorted.length - 1)] ?? Number.NaN
  return Math.round((lower + (upper - lower) * (k - lowerIndex)) * 10) / 10
}

// ---------------------------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------------------------

export type LearnerProfile = 'ideal' | 'realistic'

export type SimOptions = {
  readonly catalog: PlanCatalog
  readonly enrollment: Enrollment
  readonly profile: LearnerProfile
  readonly seed: number
  readonly days: number
  /** Day 0; the realistic learner's weeks start here. */
  readonly startDate: LocalDay
  /** Items outside the track that gain a result over time (English derived-card sources):
   *  before day d's plan, the first min(⌊(d + 1) × perDay⌋, n) get a success. */
  readonly externalResults?: { readonly itemIds: readonly string[]; readonly perDay: number }
  /** The learner's roadmap overrides for each day's plan (§5.12's scenario,
   *  `personalizedOverrides`); absent = none, the baseline learner. */
  readonly overrides?: (day: SimOverrideDay) => readonly RoadmapOverride[]
}

/** What an override policy sees before a day's plan is built. */
export type SimOverrideDay = {
  readonly index: number
  readonly date: LocalDay
  readonly items: Readonly<Record<string, ItemState>>
  /** The plans created so far (not today's). */
  readonly plans: readonly StoredPlan[]
}

export type SimDay = {
  readonly date: LocalDay
  /** The plan created that day; null when none was (gate closed, or resumed today). */
  readonly planDate: LocalDay | null
  /** The learner studied that day (a new plan or the paused one); false on a skipped day. */
  readonly studied: boolean
  /** Due, unmastered items of the track at the start of the day (dueQueue length). */
  readonly due: number
  readonly plannedMinutes: number
  readonly largestItem: number
  /** plannedMinutes ≤ budget or ≤ budget + largestItem. */
  readonly withinBudget: boolean
}

export type SimRun = {
  /** The day index on which the last roadmap item (pattern lessons, core, recap introducers; no
   *  bonus) was introduced; null if not within `days`. */
  readonly finishDay: number | null
  readonly days: readonly SimDay[]
  readonly coreIntroduced: number
  readonly coreTotal: number
}

// ---------------------------------------------------------------------------------------------
// The learner
// ---------------------------------------------------------------------------------------------

/** The realistic learner's result odds (§5.10): 80 % success, 10 % partial, 10 % fail. */
const SUCCESS_BELOW = 0.8
const PARTIAL_BELOW = 0.9
const DAYS_PER_BLOCK = 7

type Learner = {
  /** The outcome of one result. */
  readonly outcome: () => Outcome
  /** Whether day `index` is skipped. Called once per day, in day order. */
  readonly skips: (index: number) => boolean
}

/** Ideal: every result a success, no skipped day. Realistic: per result 80 / 10 / 10, and one
 *  random day per 7-day block skipped — drawn when the block starts, from the same generator as
 *  the results, so a longer run with the same seed extends a shorter one day for day. */
function learnerFor(profile: LearnerProfile, seed: number): Learner {
  if (profile === 'ideal') return { outcome: () => 'success', skips: () => false }
  const random = mulberry32(seed)
  let skipDay = -1
  return {
    outcome: () => {
      const draw = random()
      return draw < SUCCESS_BELOW ? 'success' : draw < PARTIAL_BELOW ? 'partial' : 'fail'
    },
    skips: (index) => {
      if (index % DAYS_PER_BLOCK === 0) {
        skipDay = index + Math.floor(random() * DAYS_PER_BLOCK)
      }
      return index === skipDay
    },
  }
}

// ---------------------------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------------------------

const RESULT_OF: Readonly<Record<Outcome, 'solved' | 'hint' | 'failed'>> = {
  success: 'solved',
  partial: 'hint',
  fail: 'failed',
}
const GRADE_OF: Readonly<Record<Outcome, 'pass' | 'close' | 'miss'>> = {
  success: 'pass',
  partial: 'close',
  fail: 'miss',
}

type EventBody = { readonly type: EventType; readonly payload: unknown }

/** Completion-only item types → the event that records one (§4.4) — a lookup table, so the
 *  simulation never branches on an item type. An exercise's grade is a result: it draws. */
const COMPLETIONS: Readonly<Record<string, (outcome: () => Outcome) => EventBody>> = {
  lesson: () => ({ type: 'lesson.completed', payload: {} }),
  exercise: (outcome) => ({
    type: 'exercise.submitted',
    payload: { kind: 'simulated', grade: GRADE_OF[outcome()] },
  }),
  prompt: () => ({ type: 'prompt.completed', payload: {} }),
}

type EventKeys = Pick<DomainEvent, 'trackId' | 'itemId' | 'planId' | 'blockId'>

/** Builds the events of one simulation, numbered in order. */
function eventFactory(): (day: LocalDay, body: EventBody, keys: EventKeys) => DomainEvent {
  let count = 0
  return (day, { type, payload }, keys) => {
    count += 1
    return {
      id: `sim-${count}`,
      type,
      occurredAt: `${day}T12:00:00.000Z`,
      localDay: day,
      ...keys,
      payload,
      rulesVersion: RULES_VERSION,
    }
  }
}

// ---------------------------------------------------------------------------------------------
// The roadmap
// ---------------------------------------------------------------------------------------------

/** The active items the roadmap introduces, each once: per week the pattern lessons of its topics,
 *  its core items and its recap entries without a mode — no bonus, no extended or derived cards. */
function roadmapItemIds(roadmap: PlanRoadmap, catalog: PlanCatalog, trackId: string): string[] {
  const patternLessons = Object.values(catalog.items).filter(
    (item) => item.trackId === trackId && item.itemType === 'lesson' && item.about === null,
  )
  const ids = roadmap.weeks.flatMap((week) => [
    ...patternLessons
      .filter((lesson) => lesson.topicId !== null && week.topics.includes(lesson.topicId))
      .map((lesson) => lesson.id),
    ...coreItemsOfWeek(week, catalog),
    ...week.recap.filter((entry) => entry.mode === undefined).map((entry) => entry.item),
  ])
  return [...new Set(ids)].filter((id) => isActiveItem(catalog, id))
}

/** The roadmap's active core items (§3.4), each once. */
function coreItemIds(roadmap: PlanRoadmap, catalog: PlanCatalog): string[] {
  const ids = roadmap.weeks.flatMap((week) => coreItemsOfWeek(week, catalog))
  return [...new Set(ids)].filter((id) => isActiveItem(catalog, id))
}

// ---------------------------------------------------------------------------------------------
// simulate
// ---------------------------------------------------------------------------------------------

const NO_TOPICS: ReadonlySet<string> = new Set()

/** Runs the real engine day by day (§5.10): `gateStatus` (4.3) → `buildPlan` (seen) → the
 *  learner. Ideal: every result a success, no skipped day. Realistic: per result 80 % success,
 *  10 % partial, 10 % fail (drawn from `mulberry32(seed)`); one random day per 7-day block is
 *  skipped — when the gate is open the plan is created and seen, and nothing is done. On a later
 *  day with the gate closed the learner completes the paused plan instead; the gate is then open
 *  with `resumedToday`, so no new plan is built that day (decision 32). Results become events
 *  folded with `projectChanges` (4.2, in place — M-8): SRS items (and items the catalog does not
 *  know) `item.result` (solved / hint / failed), lessons `lesson.completed`, exercises
 *  `exercise.submitted` (pass / close / miss), prompts `prompt.completed`; every block is checked
 *  in `done` with `checkInMinutes(block)` (4.6). Throws on an event the engine ignores, naming the
 *  reason. Deterministic for a seed. */
export function simulate(options: SimOptions): SimRun {
  const { catalog, enrollment, days, startDate, externalResults } = options
  const { trackId } = enrollment
  const roadmap = catalog.tracks[trackId]?.roadmaps[enrollment.variant]
  if (roadmap === undefined) {
    throw new Error(`simulate: no roadmap "${enrollment.variant}" for track "${trackId}"`)
  }
  const roadmapItems = roadmapItemIds(roadmap, catalog, trackId)
  const coreItems = coreItemIds(roadmap, catalog)
  const learner = learnerFor(options.profile, options.seed)
  const eventOf = eventFactory()

  /** The derived state, changed in place by `fold` — never handed to a caller. */
  const derived = mutableCopy(EMPTY_DERIVED_STATE)
  const plans: StoredPlan[] = []
  let externalDone = 0

  /** Stores the rows `event` changes; an event the engine ignores stops the simulation. */
  const fold = (event: DomainEvent): void => {
    const { changes, ignored } = projectChanges(derived, event, catalog)
    if (ignored !== null) {
      const item = event.itemId === null ? '' : ` for ${event.itemId}`
      throw new Error(`simulate: the engine ignored ${event.type}${item} (${ignored})`)
    }
    applyChangesInPlace(derived, changes)
  }

  /** One result of `itemId` on `day`, as the learner's outcome (or a success). An item the
   *  catalog does not know gets an `item.result`, which the engine ignores (`fold` throws). */
  const resultEvent = (day: LocalDay, itemId: string, keys: EventKeys, outcome: () => Outcome) => {
    const item = own(catalog.items, itemId)
    if (item === undefined || item.srs !== null) {
      return eventOf(day, { type: 'item.result', payload: { result: RESULT_OF[outcome()] } }, keys)
    }
    const completion = COMPLETIONS[item.itemType]
    if (completion === undefined) {
      throw new Error(`simulate: no completion event for item type "${item.itemType}"`)
    }
    return eventOf(day, completion(outcome), keys)
  }

  /** The learner does `blocks` of `plan` on `day`: every item, then a `done` check-in. */
  const work = (day: LocalDay, plan: StoredPlan, blocks: readonly PlanBlock[]) => {
    for (const block of blocks) {
      const keys = { trackId, planId: plan.id, blockId: block.id }
      for (const planned of block.items) {
        fold(
          resultEvent(day, planned.itemId, { ...keys, itemId: planned.itemId }, () =>
            learner.outcome(),
          ),
        )
      }
      const checkIn = {
        type: 'block.checked_in',
        payload: { status: 'done', minutes: checkInMinutes(block) },
      } as const
      fold(eventOf(day, checkIn, { ...keys, itemId: null }))
    }
  }

  /** Before day `index`'s plan, the external sources that have gained a result by then. */
  const applyExternalResults = (index: number, day: LocalDay) => {
    if (externalResults === undefined) return
    const { itemIds, perDay } = externalResults
    const target = Math.min(Math.floor((index + 1) * perDay), itemIds.length)
    for (; externalDone < target; externalDone += 1) {
      const itemId = itemIds[externalDone] ?? ''
      const trackOf = own(catalog.items, itemId)?.trackId ?? null
      const keys = { trackId: trackOf, itemId, planId: null, blockId: null }
      fold(resultEvent(day, itemId, keys, () => 'success'))
    }
  }

  const simDays: SimDay[] = []
  let finishDay: number | null = null

  for (let index = 0; index < days; index += 1) {
    const date = addDays(startDate, index)
    const due = dueQueue({
      trackId,
      items: derived.items,
      catalog,
      today: date,
      weakTopicIds: NO_TOPICS,
    }).length
    applyExternalResults(index, date)
    const skipped = learner.skips(index)

    /** The blocks the day planned or worked from (a new plan and / or the paused one). */
    const dayBlocks: PlanBlock[] = []
    let studied = false
    let planDate: LocalDay | null = null

    let gate = gateStatus(plans, derived.blocks, date)
    if (!gate.open && !skipped) {
      const paused = unfinishedBlocks(gate.lastSeen, derived.blocks)
      work(date, gate.lastSeen, paused)
      dayBlocks.push(...paused)
      studied = true
      gate = gateStatus(plans, derived.blocks, date)
    }
    if (gate.open && !gate.resumedToday) {
      const overrides = options.overrides?.({ index, date, items: derived.items, plans })
      const built = buildPlan({
        planDate: date,
        catalog,
        enrollments: [enrollment],
        items: derived.items,
        recapDone: recapWeeksDone(plans, derived.blocks, [enrollment]),
        ...(overrides !== undefined && { overrides }),
      })
      const plan: StoredPlan = {
        id: `plan-${date}`,
        planDate: date,
        version: 1,
        source: 'baseline',
        seenAt: `${date}T12:00:00.000Z`,
        blocks: built.blocks,
        tracks: built.tracks,
      }
      plans.push(plan)
      planDate = date
      dayBlocks.push(...plan.blocks)
      if (!skipped) {
        work(date, plan, plan.blocks)
        studied = true
      }
    }

    const minutes = plannedMinutes({ blocks: dayBlocks }, trackId)
    const largestItem = largestItemMinutes({ blocks: dayBlocks }, trackId)
    simDays.push({
      date,
      planDate,
      studied,
      due,
      plannedMinutes: minutes,
      largestItem,
      withinBudget: minutes <= enrollment.budgetMinutes + largestItem,
    })

    if (finishDay === null && roadmapItems.every((id) => derived.items[id] !== undefined)) {
      finishDay = index
    }
  }

  return {
    finishDay,
    days: simDays,
    coreIntroduced: coreItems.filter((id) => derived.items[id] !== undefined).length,
    coreTotal: coreItems.length,
  }
}

// ---------------------------------------------------------------------------------------------
// §5.12's scenario: the realistic learner with overrides
// ---------------------------------------------------------------------------------------------

/** One `extra_week` per this many roadmap weeks (§5.12 simulation bullet). */
const EXTRA_WEEK_EVERY = 4
/** The two `insert_block`s, always active: their weekdays (Sunday has the mock interview). */
const INSERT_WEEKDAYS: readonly (readonly Weekday[])[] = [
  ['mon', 'wed', 'fri'],
  ['tue', 'thu', 'sat'],
]

/** What a `personalizedOverrides` policy did (read after the run). */
export type OverrideStats = {
  readonly extraWeeks: number
  readonly insertBlocks: number
  /** Plans that named an extra week / held an insert block's practice, as last seen. */
  readonly extraWeekPlans: number
  readonly topicPracticeBlocks: number
}

/** The topic with the most Weak items of `trackId` (active catalog items), then topic ID; null
 *  when no item is Weak. */
function weakestTopic(
  catalog: PlanCatalog,
  items: Readonly<Record<string, ItemState>>,
  trackId: string,
): string | null {
  const counts = new Map<string, number>()
  for (const state of Object.values(items)) {
    const item = own(catalog.items, state.itemId)
    if (state.status !== 'weak' || item?.status !== 'active' || item.trackId !== trackId) continue
    if (item.topicId === null) continue
    counts.set(item.topicId, (counts.get(item.topicId) ?? 0) + 1)
  }
  const [best] = [...counts].toSorted((a, b) => b[1] - a[1] || compareIds(a[0], b[0]))
  return best?.[0] ?? null
}

/**
 * The §5.12 simulation scenario's learner: two `insert_block`s always active — one on the
 * weakest topic (most Weak items, else the current week's), Monday / Wednesday / Friday; one on
 * the current roadmap week's first topic, Tuesday / Thursday / Saturday — each of 25 % of the
 * budget, set for 14 days and set again when it expires; and one `extra_week` of 5 study days per
 * four roadmap weeks (from week 4, 8, …, on the weakest topic once one has a Weak item). Every
 * override it sets passes `validateOverride` (it throws otherwise). Deterministic; one policy per
 * run (it keeps state). `stats()` reports what it did.
 */
export function personalizedOverrides(
  catalog: PlanCatalog,
  enrollment: Enrollment,
): ((day: SimOverrideDay) => readonly RoadmapOverride[]) & { stats: () => OverrideStats } {
  const { trackId } = enrollment
  const roadmap = catalog.tracks[trackId]?.roadmaps[enrollment.variant] ?? null
  const minutes = Math.floor(OVERRIDE_LIMITS.insertBlockMaxBudgetShare * enrollment.budgetMinutes)
  const inserts: (InsertBlockOverride | null)[] = INSERT_WEEKDAYS.map(() => null)
  let extra: ExtraWeekOverride | null = null
  let nextExtraWeek = EXTRA_WEEK_EVERY
  let extraWeeks = 0
  let insertBlocks = 0
  let seen: readonly StoredPlan[] = []

  const accept = <T extends RoadmapOverride>(
    override: T,
    day: SimOverrideDay,
    active: readonly RoadmapOverride[],
  ): T => {
    const issues = validateOverride(override, {
      catalog,
      enrollment,
      items: day.items,
      today: day.date,
      limits: OVERRIDE_LIMITS,
      overrides: active,
    })
    if (issues.length > 0) {
      throw new Error(`personalizedOverrides: ${override.key} refused (${JSON.stringify(issues)})`)
    }
    return override
  }

  const policy = (day: SimOverrideDay): readonly RoadmapOverride[] => {
    seen = day.plans
    const week = roadmapWeek(roadmap, catalog, day.items)
    const currentTopic = roadmap?.weeks.find((candidate) => candidate.week === week)?.topics[0]
    const weakest = weakestTopic(catalog, day.items, trackId)

    if (extra !== null) {
      const { key, startLocalDay } = extra
      const usedDays = day.plans.filter(
        (plan) => plan.planDate >= startLocalDay && plan.tracks[trackId]?.extraWeek === key,
      ).length
      extra = usedDays < extra.params.studyDays ? { ...extra, usedDays } : null
    }

    const active = (): RoadmapOverride[] => [
      ...inserts.filter((insert) => insert !== null),
      ...(extra === null ? [] : [extra]),
    ]

    INSERT_WEEKDAYS.forEach((weekdays, slot) => {
      const current = inserts[slot] ?? null
      if (current !== null && current.params.until >= day.date) return
      const topicId = slot === 0 ? (weakest ?? currentTopic) : currentTopic
      if (topicId === undefined) return
      insertBlocks += 1
      inserts[slot] = accept(
        {
          trackId,
          key: `insert-${slot}-${insertBlocks}`,
          kind: 'insert_block',
          params: { topicId, weekdays, minutes, until: addDays(day.date, 14) },
          startLocalDay: day.date,
        },
        day,
        active().filter((other) => other !== current),
      )
    })

    if (extra === null && week >= nextExtraWeek && weakest !== null) {
      extraWeeks += 1
      nextExtraWeek += EXTRA_WEEK_EVERY
      extra = accept(
        {
          trackId,
          key: `extra-${extraWeeks}`,
          kind: 'extra_week',
          params: { topicId: weakest, studyDays: OVERRIDE_LIMITS.extraWeekMaxStudyDays },
          startLocalDay: day.date,
          usedDays: 0,
        },
        day,
        active(),
      )
    }
    return active()
  }

  const stats = (): OverrideStats => ({
    extraWeeks,
    insertBlocks,
    extraWeekPlans: seen.filter((plan) => plan.tracks[trackId]?.extraWeek !== undefined).length,
    topicPracticeBlocks: seen
      .flatMap((plan) => plan.blocks)
      .filter((block) => block.tag === TOPIC_PRACTICE_TAG || block.tag === EXTRA_WEEK_TAG).length,
  })
  return Object.assign(policy, { stats })
}
