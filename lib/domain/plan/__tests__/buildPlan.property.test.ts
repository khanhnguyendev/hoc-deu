/**
 * Property tests for `buildPlan` and `buildResumePlan` (platform design §5.4 invariant, §5.8; task
 * 4.6): arbitrary budgets (10–240, step 5), weekdays, item states for random subsets of `CATALOG`
 * (consistent with `srsStatus`), a few items made draft or retired, bonus, newPerDay, throttle
 * rules, recap history and — in half of the runs — random custom weekly templates (decision 13).
 */
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import type {
  PlanCatalog,
  PlanTemplateBlock,
  PlanWeeklyTemplate,
  TemplateDayKey,
} from '../../catalog'
import { srsStatus } from '../../srs/applyResult'
import type { ItemState } from '../../state'
import { addDays, type LocalDay } from '../../time/localDay'
import { buildPlan, largestItemMinutes, plannedMinutes } from '../buildPlan'
import { buildResumePlan } from '../resume'
import { planBlockSchema, type DayPlan, type PlanContext, type StoredPlan } from '../types'
import { CATALOG, enrollment, itemState, MONDAY, statesOf, withItems } from './fixtures'

const RUNS = { numRuns: 300 }
const ITEM_IDS = Object.keys(CATALOG.items)
const BLOCK_ID = /^\d{4}-\d{2}-\d{2}:[a-z][a-z0-9-]*:(review|new|recap|practice|extra):\d+$/
const SHARED_KEYS: readonly TemplateDayKey[] = ['mon-fri', 'sat', 'sun']
const WEEKDAY_KEYS: readonly TemplateDayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri']
const NON_SRS_RESULTS = ['completed', 'pass', 'close', 'miss'] as const

// ---------------------------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------------------------

/** An item's state on `planDate`, consistent with §5.7: SRS items at level 1…N with the status
 *  `srsStatus` gives (level 0 = skipped); completion-only items at level 0, never due. */
function stateArb(itemId: string, planDate: LocalDay): fc.Arbitrary<ItemState> {
  const srs = CATALOG.items[itemId]?.srs ?? null
  return fc
    .record({
      level: fc.integer({ min: 0, max: srs === null ? 0 : srs.intervals.length }),
      weak: fc.boolean(),
      topSuccesses: fc.integer({ min: 0, max: 2 }),
      dueOffset: fc.integer({ min: -20, max: 20 }),
      introducedAgo: fc.integer({ min: 0, max: 30 }),
      lastResultAgo: fc.integer({ min: 0, max: 30 }),
      skipped: fc.boolean(),
      result: fc.constantFrom(...NON_SRS_RESULTS),
    })
    .map((raw) => {
      const introducedOn = addDays(planDate, -Math.max(raw.introducedAgo, raw.lastResultAgo))
      const lastResultOn = addDays(planDate, -raw.lastResultAgo)
      const skipped = srs === null ? raw.skipped : raw.level === 0
      if (skipped) {
        return itemState(itemId, introducedOn, {
          level: 0,
          status: 'skipped',
          lastResult: null,
          lastResultOn: null,
        })
      }
      if (srs === null) {
        return itemState(itemId, introducedOn, { lastResult: raw.result, lastResultOn })
      }
      const status = srsStatus(raw.level, raw.weak, raw.topSuccesses, srs)
      return itemState(itemId, introducedOn, {
        level: raw.level,
        weak: raw.weak,
        topSuccesses: raw.topSuccesses,
        status,
        dueOn: status === 'mastered' ? null : addDays(planDate, raw.dueOffset),
        lastResultOn,
      })
    })
}

const itemsArb = (planDate: LocalDay): fc.Arbitrary<Readonly<Record<string, ItemState>>> =>
  fc
    .subarray(ITEM_IDS)
    .chain((ids) => fc.tuple(...ids.map((id) => stateArb(id, planDate))))
    .map((states) => statesOf(...states))

/** `CATALOG` with up to three items made draft or retired. */
const catalogArb: fc.Arbitrary<PlanCatalog> = fc
  .subarray(ITEM_IDS, { maxLength: 3 })
  .chain((ids) =>
    fc.tuple(
      ...ids.map((id) =>
        fc.constantFrom('draft' as const, 'retired' as const).map((status) => [id, { status }]),
      ),
    ),
  )
  .map((changes) => withItems(CATALOG, Object.fromEntries(changes)))

const fromWeek = fc.integer({ min: 1, max: 3 })
const optional = { requiredKeys: ['kind'] as 'kind'[], noNullPrototype: true }

/** Any block a learner could store (the manifest's `templateBlockSchema`). */
const blockArb: fc.Arbitrary<PlanTemplateBlock> = fc.oneof(
  fc.record(
    { kind: fc.constant('review' as const), maxMinutes: fc.integer({ min: 1, max: 60 }), fromWeek },
    optional,
  ),
  fc.record({ kind: fc.constant('new' as const), fromWeek }, optional),
  fc.record(
    { kind: fc.constant('recap' as const), count: fc.integer({ min: 1, max: 5 }), fromWeek },
    { requiredKeys: ['kind', 'count'], noNullPrototype: true },
  ),
  fc.record(
    {
      kind: fc.constant('practice' as const),
      minutes: fc.integer({ min: 1, max: 60 }),
      tag: fc.constantFrom('mock-interview', 'weekend-task', 'shadowing', 'no-such-tag'),
      fromWeek,
    },
    { requiredKeys: ['kind', 'minutes', 'tag'], noNullPrototype: true },
  ),
  fc.record(
    {
      kind: fc.constant('practice' as const),
      minutes: fc.integer({ min: 1, max: 60 }),
      itemType: fc.constantFrom('exercise', 'prompt', 'lesson', 'problem', 'flashcard'),
      fromWeek,
    },
    { requiredKeys: ['kind', 'minutes', 'itemType'], noNullPrototype: true },
  ),
)

/** A custom weekly template: 1–4 blocks for 'mon-fri', 'sat' and 'sun', and for any of the
 *  weekdays' own keys — any order and kinds. */
const templateArb: fc.Arbitrary<PlanWeeklyTemplate> = fc
  .subarray([...WEEKDAY_KEYS])
  .chain((weekdays) =>
    fc.tuple(
      ...[...SHARED_KEYS, ...weekdays].map((key) =>
        fc.array(blockArb, { minLength: 1, maxLength: 4 }).map((blocks) => [key, blocks] as const),
      ),
    ),
  )
  .map((days) => Object.fromEntries(days))

/** Budgets of 10–240 minutes in steps of 5. */
const budgetArb = (max: number) => fc.integer({ min: 2, max: max / 5 }).map((steps) => steps * 5)

const enrollmentArb = (trackId: 'dsa' | 'english', custom: boolean, budget: fc.Arbitrary<number>) =>
  fc
    .record({
      variant:
        trackId === 'dsa'
          ? fc.oneof(
              { arbitrary: fc.constant('8w'), weight: 4 },
              { arbitrary: fc.constant('10w'), weight: 1 },
            )
          : fc.constant('10w'),
      budgetMinutes: budget,
      includeBonus: fc.boolean(),
      newPerDay: fc.option(fc.integer({ min: 0, max: 10 }), { nil: null }),
      throttle: fc.array(
        fc.record({
          dueAbove: fc.integer({ min: 0, max: 60 }),
          newPerDay: fc.integer({ min: 0, max: 10 }),
        }),
        { maxLength: 3 },
      ),
      template: custom ? templateArb.map((template) => ({ template })) : fc.constant(null),
    })
    .map(({ template, ...change }) =>
      enrollment(
        trackId,
        template === null ? change : { ...change, weeklyTemplate: template.template },
      ),
    )

const recapDoneArb = fc.subarray([1, 2, 3]).map((weeks) => new Set(weeks))

/** p3 Weak and due with its deep-dive not studied — the §5.4 step 3 lead (rare otherwise). */
function withOpenDeepDive(
  items: Readonly<Record<string, ItemState>>,
  planDate: LocalDay,
  overdue: number,
): Record<string, ItemState> {
  const rest = Object.entries(items).filter(([itemId]) => itemId !== 'dsa:lesson-deep-dive-p3')
  const due = addDays(planDate, -overdue)
  return {
    ...Object.fromEntries(rest),
    'dsa:p3': itemState('dsa:p3', addDays(due, -3), { weak: true, status: 'weak', dueOn: due }),
  }
}

/** Object.freeze all the way down. */
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value)) deepFreeze(child)
  }
  return value
}

/** Plan contexts on MONDAY … SUNDAY with both tracks enrolled; `custom` decides whether the
 *  enrollments carry random weekly templates. A quarter of them has an open deep-dive. */
const contextArb = (
  custom: fc.Arbitrary<boolean>,
  budget: fc.Arbitrary<number>,
): fc.Arbitrary<PlanContext> =>
  fc
    .record({ dayOffset: fc.integer({ min: 0, max: 6 }), custom })
    .chain(({ dayOffset, custom: isCustom }) => {
      const planDate = addDays(MONDAY, dayOffset)
      return fc.record({
        planDate: fc.constant(planDate),
        catalog: catalogArb,
        items: itemsArb(planDate),
        deepDive: fc.oneof(
          { arbitrary: fc.constant(null), weight: 3 },
          { arbitrary: fc.integer({ min: 0, max: 10 }), weight: 1 },
        ),
        dsa: enrollmentArb('dsa', isCustom, budget),
        english: enrollmentArb('english', isCustom, budget),
        recapDsa: recapDoneArb,
        recapEnglish: recapDoneArb,
      })
    })
    .map(({ planDate, catalog, items, deepDive, dsa, english, recapDsa, recapEnglish }) =>
      deepFreeze({
        planDate,
        catalog,
        enrollments: [dsa, english],
        items: deepDive === null ? items : withOpenDeepDive(items, planDate, deepDive),
        recapDone: { dsa: recapDsa, english: recapEnglish },
      }),
    )

/** §5.4's generator: budgets 10–240, a random custom template in half of the runs. */
const anyContext = contextArb(fc.boolean(), budgetArb(240))
/** Review focus 1: tiny budgets (10–30) against big fixed blocks, always a custom template. */
const tinyBudgetContext = contextArb(fc.constant(true), budgetArb(30))

// ---------------------------------------------------------------------------------------------
// Invariants
// ---------------------------------------------------------------------------------------------

const planItemIds = (plan: DayPlan): string[] =>
  plan.blocks.flatMap((block) => block.items.map((planned) => planned.itemId))

/** I1–I6 for every track of `plan`. */
function checkInvariants(ctx: PlanContext, plan: DayPlan): void {
  const { catalog, items, planDate } = ctx

  // (I1) planned ≤ budget, or ≤ budget + the largest single item (§5.4 invariant).
  for (const trackId of Object.keys(plan.tracks)) {
    const budget = ctx.enrollments.find((e) => e.trackId === trackId)?.budgetMinutes ?? 0
    const planned = plannedMinutes(plan, trackId)
    const largest = largestItemMinutes(plan, trackId)
    expect(
      planned <= budget || planned <= budget + largest,
      `I1 ${trackId}: planned ${planned} > budget ${budget} + largest ${largest}`,
    ).toBe(true)
  }

  // (I2) no item ID twice in the plan.
  const ids = planItemIds(plan)
  expect(new Set(ids).size, `I2 duplicate item in ${ids.join(', ')}`).toBe(ids.length)

  // (I3) new items are not introduced; review items are due (or a deep-dive lead); recap items
  // are introduced.
  for (const block of plan.blocks) {
    block.items.forEach((planned, index) => {
      const state = items[planned.itemId]
      const item = catalog.items[planned.itemId]
      const where = `I3 ${block.id} ${planned.itemId} (${planned.mode})`
      if (block.kind === 'new') expect(state, where).toBeUndefined()
      if (block.kind === 'recap') expect(state, where).toBeDefined()
      if (block.kind !== 'review') return
      expect(item?.status, where).toBe('active')
      if (planned.mode === 'new') {
        const next = block.items[index + 1]
        expect(state, where).toBeUndefined()
        expect(item?.itemType, where).toBe('lesson')
        expect(next, where).toBeDefined()
        expect(catalog.items[next?.itemId ?? '']?.deepDiveId, where).toBe(planned.itemId)
        expect(items[next?.itemId ?? '']?.weak, where).toBe(true)
      } else {
        expect(state?.dueOn != null && state.dueOn <= planDate, where).toBe(true)
        expect(['mastered', 'skipped'], where).not.toContain(state?.status)
      }
    })
  }

  // (I4) no empty block; unique, well-formed block IDs; blocks match the stored schema.
  const blockIds = plan.blocks.map((block) => block.id)
  expect(new Set(blockIds).size, `I4 duplicate block id in ${blockIds.join(', ')}`).toBe(
    blockIds.length,
  )
  for (const block of plan.blocks) {
    expect(block.id, 'I4').toMatch(BLOCK_ID)
    expect(block.id.split(':')[1], 'I4 track in id').toBe(block.trackId)
    expect(planBlockSchema.safeParse(block).success, `I4 schema ${block.id}`).toBe(true)
    if (block.kind === 'practice') {
      expect(block.items.length + (block.shadowing?.length ?? 0), `I4 ${block.id}`).toBeGreaterThan(
        0,
      )
    } else {
      expect(block.items.length, `I4 ${block.id}`).toBeGreaterThan(0)
      const sum = block.items.reduce((total, planned) => total + planned.minutes, 0)
      expect(block.estMinutes, `estMinutes ${block.id}`).toBe(sum)
    }
  }

  // (I5) no draft or retired item (shadowing cards included).
  const shown = [...ids, ...plan.blocks.flatMap((block) => block.shadowing ?? [])]
  for (const id of shown) expect(catalog.items[id]?.status, `I5 ${id}`).toBe('active')

  // (I6) SRS items in new blocks ≤ the snapshot's newPerDay.
  for (const [trackId, snapshot] of Object.entries(plan.tracks)) {
    if (snapshot.newPerDay === null) continue
    const newSrs = plan.blocks
      .filter((block) => block.trackId === trackId && block.kind === 'new')
      .flatMap((block) => block.items)
      .filter((planned) => catalog.items[planned.itemId]?.srs != null)
    expect(newSrs.length, `I6 ${trackId}`).toBeLessThanOrEqual(snapshot.newPerDay)
  }
}

/** The baseline plan's invariants: I1–I6, then (I7) the same plan when built again. */
const baselineInvariants = (ctx: PlanContext): void => {
  const plan = buildPlan(ctx)
  expect(plan.planDate).toBe(ctx.planDate)
  expect(plan.mode).toBe('baseline')
  checkInvariants(ctx, plan)
  expect(buildPlan(ctx)).toStrictEqual(plan)
}

describe('buildPlan invariants (§5.4, decision 13)', () => {
  it('I1–I7 hold for arbitrary contexts (a random custom template in half of the runs)', () => {
    fc.assert(fc.property(anyContext, baselineInvariants), RUNS)
  })

  it('I1–I7 hold for tiny budgets (10–30) and random custom templates (review focus 1)', () => {
    fc.assert(fc.property(tinyBudgetContext, baselineInvariants), RUNS)
  })
})

describe('buildResumePlan invariants (§5.8)', () => {
  it('I1–I7 hold, and new items are only the stale plan’s', () => {
    fc.assert(
      fc.property(anyContext, fc.integer({ min: 3, max: 10 }), (ctx, daysAgo) => {
        const staleDay = addDays(ctx.planDate, -daysAgo)
        const built = buildPlan({ ...ctx, planDate: staleDay })
        const stale: StoredPlan = deepFreeze({
          id: 'stale',
          planDate: staleDay,
          version: 1,
          source: 'baseline',
          seenAt: `${staleDay}T03:00:00Z`,
          blocks: built.blocks,
          tracks: built.tracks,
        })
        const plan = buildResumePlan(ctx, stale)
        expect(plan.mode).toBe('resume')
        checkInvariants(ctx, plan)
        for (const block of plan.blocks) {
          expect(['review', 'new'], block.id).toContain(block.kind)
          if (block.kind !== 'new') continue
          const staleNew = stale.blocks
            .filter((old) => old.trackId === block.trackId && old.kind === 'new')
            .flatMap((old) => old.items.map((planned) => planned.itemId))
          for (const planned of block.items) expect(staleNew).toContain(planned.itemId)
        }
        expect(buildResumePlan(ctx, stale)).toStrictEqual(plan)
      }),
      RUNS,
    )
  })
})
