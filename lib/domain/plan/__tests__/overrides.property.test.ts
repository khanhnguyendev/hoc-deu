/**
 * Property tests for roadmap overrides (platform design §5.12 invariants, §6.10; task 6.6b): for
 * any accepted override set — a reorder of the upcoming topics that keeps `requires`, up to two
 * `insert_block`s and an `extra_week` within the §6.4.5 bounds, at most three per track, each
 * checked with `validateOverride` — on arbitrary learner states (`srsStatus`-consistent), budgets,
 * weekdays and custom items: every core item of the roadmap stays in the effective roadmap and the
 * effective new-item queue exactly once, and every built plan keeps the planned-minutes invariant
 * (§5.4) and the stored-plan schema. Without overrides the plan is the baseline plan.
 */
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import type { PlanCatalog, PlanItem, Weekday } from '../../catalog'
import { srsStatus } from '../../srs/applyResult'
import type { ItemState } from '../../state'
import { addDays, type LocalDay } from '../../time/localDay'
import { buildPlan, largestItemMinutes, plannedMinutes } from '../buildPlan'
import {
  effectiveRoadmap,
  OVERRIDE_LIMITS,
  overrideActive,
  type RoadmapOverride,
  upcomingTopics,
  validateOverride,
} from '../overrides'
import { coreItemsOfWeek, newQueue } from '../roadmap'
import { planBlockSchema, trackSnapshotSchema, type Enrollment, type PlanContext } from '../types'
import { itemState, MONDAY } from './fixtures'
import {
  customCard,
  LAB_ROADMAP,
  LAB_TOPICS,
  LAB_TRACK,
  labCatalogWith,
  labEnrollment,
} from './overrideFixtures'

const RUNS = { numRuns: 300 }
const WEEKDAYS: readonly Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const TOPIC_IDS = LAB_TOPICS.map((topic) => topic.id)

// ---------------------------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------------------------

/** The lab catalog with 0–3 custom cards on random topics. */
const catalogArb: fc.Arbitrary<PlanCatalog> = fc
  .uniqueArray(fc.constantFrom(...TOPIC_IDS), { maxLength: 3 })
  .map((topics) => labCatalogWith(...topics.map((topic) => customCard(`${topic}-card`, topic))))

/** An SRS item's state on `planDate`, consistent with §5.7 (as buildPlan.property.test.ts). */
function stateArb(
  item: PlanItem,
  planDate: LocalDay,
  catalog: PlanCatalog,
): fc.Arbitrary<ItemState> {
  const srs = item.srs
  return fc
    .record({
      level: fc.integer({ min: 0, max: srs === null ? 0 : srs.intervals.length }),
      weak: fc.boolean(),
      topSuccesses: fc.integer({ min: 0, max: 2 }),
      dueOffset: fc.integer({ min: -20, max: 20 }),
      ago: fc.integer({ min: 0, max: 30 }),
    })
    .map((raw) => {
      const introducedOn = addDays(planDate, -raw.ago)
      if (srs === null) return itemState(item.id, introducedOn, {}, catalog)
      if (raw.level === 0) {
        return itemState(
          item.id,
          introducedOn,
          { level: 0, status: 'skipped', lastResult: null, lastResultOn: null },
          catalog,
        )
      }
      const status = srsStatus(raw.level, raw.weak, raw.topSuccesses, srs)
      return itemState(
        item.id,
        introducedOn,
        {
          level: raw.level,
          weak: raw.weak,
          topSuccesses: raw.topSuccesses,
          status,
          dueOn: status === 'mastered' ? null : addDays(planDate, raw.dueOffset),
        },
        catalog,
      )
    })
}

/** A learner who has introduced a prefix of the roadmap (roughly in order) plus a few random
 *  items — out-of-order starts included. */
function itemsArb(
  catalog: PlanCatalog,
  planDate: LocalDay,
): fc.Arbitrary<Readonly<Record<string, ItemState>>> {
  const ordered = newQueue({
    trackId: 'dsa',
    roadmap: LAB_ROADMAP,
    catalog,
    items: {},
    includeBonus: true,
  })
  const all = Object.values(catalog.items).map((item) => item.id)
  return fc
    .record({
      prefix: fc.integer({ min: 0, max: ordered.length }),
      extra: fc.subarray(all, { maxLength: 4 }),
    })
    .chain(({ prefix, extra }) => {
      const ids = [...new Set([...ordered.slice(0, prefix), ...extra])]
      return fc.tuple(...ids.map((id) => stateArb(catalog.items[id]!, planDate, catalog)))
    })
    .map((states) => Object.fromEntries(states.map((state) => [state.itemId, state])))
}

/** A `requires`-respecting random order of `upcoming`: Kahn's algorithm over the not-started
 *  prerequisites, taking the available topic with the lowest random priority each step. */
function validOrder(upcoming: readonly string[], priorities: readonly number[]): string[] {
  const requires = new Map(LAB_TOPICS.map((topic) => [topic.id, topic.requires]))
  const pending = new Set(upcoming)
  const order: string[] = []
  while (pending.size > 0) {
    const available = [...pending].filter((topic) =>
      (requires.get(topic) ?? []).every((required) => !pending.has(required)),
    )
    const next = available.toSorted(
      (a, b) =>
        (priorities[upcoming.indexOf(a)] ?? 0) - (priorities[upcoming.indexOf(b)] ?? 0) ||
        a.localeCompare(b),
    )[0]
    if (next === undefined) break
    order.push(next)
    pending.delete(next)
  }
  return order
}

type Scenario = {
  readonly ctx: PlanContext
  readonly enrollment: Enrollment
}

const scenarioArb: fc.Arbitrary<Scenario> = fc
  .record({
    catalog: catalogArb,
    dayOffset: fc.integer({ min: 0, max: 6 }),
    budget: fc.integer({ min: 2, max: 48 }).map((steps) => steps * 5),
  })
  .chain(({ catalog, dayOffset, budget }) => {
    const planDate = addDays(MONDAY, dayOffset)
    return fc.record({
      catalog: fc.constant(catalog),
      planDate: fc.constant(planDate),
      enrollment: fc.constant(labEnrollment({ budgetMinutes: budget })),
      items: itemsArb(catalog, planDate),
      reorder: fc.option(
        fc.array(fc.integer({ min: 0, max: 100 }), { minLength: 7, maxLength: 7 }),
      ),
      inserts: fc.array(
        fc.record({
          topicId: fc.constantFrom(...TOPIC_IDS),
          weekdays: fc.uniqueArray(fc.constantFrom(...WEEKDAYS), { minLength: 1, maxLength: 7 }),
          share: fc.double({ min: 0, max: 1, noNaN: true }),
          daysAhead: fc.integer({ min: 0, max: 14 }),
        }),
        { maxLength: 2 },
      ),
      extra: fc.option(
        fc.record({
          topicId: fc.constantFrom(...TOPIC_IDS),
          studyDays: fc.integer({ min: 1, max: 5 }),
          usedDays: fc.integer({ min: 0, max: 6 }),
        }),
      ),
    })
  })
  .map(({ catalog, planDate, enrollment, items, reorder, inserts, extra }) => {
    const maxMinutes = Math.floor(
      OVERRIDE_LIMITS.insertBlockMaxBudgetShare * enrollment.budgetMinutes,
    )
    const proposed: RoadmapOverride[] = []
    if (reorder !== null) {
      const upcoming = upcomingTopics(LAB_TRACK, LAB_ROADMAP, [], catalog, items)
      if (upcoming.length > 0) {
        proposed.push({
          trackId: 'dsa',
          key: 'ro',
          kind: 'reorder_topics',
          params: { order: validOrder(upcoming, reorder) },
          startLocalDay: planDate,
        })
      }
    }
    inserts.forEach((insert, index) => {
      proposed.push({
        trackId: 'dsa',
        key: `ib-${index}`,
        kind: 'insert_block',
        params: {
          topicId: insert.topicId,
          weekdays: insert.weekdays,
          minutes: Math.max(1, Math.round(insert.share * maxMinutes)),
          until: addDays(planDate, insert.daysAhead),
        },
        startLocalDay: planDate,
      })
    })
    if (extra !== null) {
      proposed.push({
        trackId: 'dsa',
        key: 'ew',
        kind: 'extra_week',
        params: { topicId: extra.topicId, studyDays: extra.studyDays },
        startLocalDay: planDate,
        usedDays: extra.usedDays,
      })
    }
    // Accept in order, as the API would: each checked against those accepted before; ≤ 3.
    const accepted: RoadmapOverride[] = []
    for (const override of proposed) {
      if (accepted.length >= 3) break
      const issues = validateOverride(override, {
        catalog,
        enrollment,
        items,
        today: planDate,
        limits: OVERRIDE_LIMITS,
        overrides: accepted,
      })
      if (issues.length === 0) accepted.push(override)
    }
    const ctx: PlanContext = {
      planDate,
      catalog,
      enrollments: [enrollment],
      items,
      recapDone: {},
      overrides: accepted,
    }
    return { ctx, enrollment }
  })

// ---------------------------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------------------------

const count = (values: readonly string[], value: string): number =>
  values.filter((candidate) => candidate === value).length

describe('roadmap overrides — invariants (§5.12, §6.10)', () => {
  it('generates accepted reorders, insert blocks and extra weeks', () => {
    const kinds = new Set<string>()
    fc.assert(
      fc.property(scenarioArb, ({ ctx }) => {
        for (const override of ctx.overrides ?? []) kinds.add(override.kind)
      }),
      RUNS,
    )
    expect([...kinds].sort()).toEqual(['extra_week', 'insert_block', 'reorder_topics'])
  })

  it('every core item stays in the effective roadmap exactly once, each week keeping its count', () => {
    fc.assert(
      fc.property(scenarioArb, ({ ctx }) => {
        const effective = effectiveRoadmap(
          LAB_ROADMAP,
          LAB_TRACK,
          ctx.overrides ?? [],
          ctx.catalog,
          ctx.items,
        )
        const baseCore = LAB_ROADMAP.weeks.flatMap((week) => coreItemsOfWeek(week, ctx.catalog))
        const core = effective.weeks.flatMap((week) => coreItemsOfWeek(week, ctx.catalog))
        expect(core.toSorted()).toEqual(baseCore.toSorted())
        for (const itemId of baseCore) expect(count(core, itemId), itemId).toBe(1)
        effective.weeks.forEach((week, index) => {
          const base = LAB_ROADMAP.weeks[index]!
          expect(week.core.length).toBe(base.core.length)
          expect(week.bonus).toEqual(base.bonus)
          expect(week.recap).toEqual(base.recap)
          expect(week.decks).toEqual(base.decks)
        })
      }),
      RUNS,
    )
  })

  it('every not-introduced core item appears in the effective queue exactly once', () => {
    fc.assert(
      fc.property(scenarioArb, fc.boolean(), ({ ctx }, includeBonus) => {
        const effective = effectiveRoadmap(
          LAB_ROADMAP,
          LAB_TRACK,
          ctx.overrides ?? [],
          ctx.catalog,
          ctx.items,
        )
        const queue = newQueue({
          trackId: 'dsa',
          roadmap: effective,
          catalog: ctx.catalog,
          items: ctx.items,
          includeBonus,
        })
        expect(new Set(queue).size).toBe(queue.length)
        const core = LAB_ROADMAP.weeks.flatMap((week) => coreItemsOfWeek(week, ctx.catalog))
        for (const itemId of core) {
          expect(count(queue, itemId), itemId).toBe(ctx.items[itemId] === undefined ? 1 : 0)
        }
        for (const itemId of queue) expect(itemId.startsWith('user:'), itemId).toBe(false)
      }),
      RUNS,
    )
  })

  it('every built plan keeps the planned-minutes invariant (§5.4) and the stored schema', () => {
    fc.assert(
      fc.property(scenarioArb, ({ ctx, enrollment }) => {
        const plan = buildPlan(ctx)
        const planned = plannedMinutes(plan, 'dsa')
        const largest = largestItemMinutes(plan, 'dsa')
        expect(
          planned <= enrollment.budgetMinutes + largest,
          `planned ${planned} > budget ${enrollment.budgetMinutes} + largest ${largest}`,
        ).toBe(true)
        const ids = plan.blocks.flatMap((block) => block.items.map((planned) => planned.itemId))
        expect(new Set(ids).size, ids.join(', ')).toBe(ids.length)
        for (const block of plan.blocks) {
          expect(planBlockSchema.safeParse(block).success, block.id).toBe(true)
          for (const planned of block.items) {
            expect(ctx.catalog.items[planned.itemId]?.status, planned.itemId).toBe('active')
          }
        }
        for (const snapshot of Object.values(plan.tracks)) {
          expect(trackSnapshotSchema.safeParse(snapshot).success).toBe(true)
        }
        expect(buildPlan(ctx)).toStrictEqual(plan)
      }),
      RUNS,
    )
  })

  it('an active extra week introduces no new item; its key is in the snapshot', () => {
    fc.assert(
      fc.property(scenarioArb, ({ ctx }) => {
        const extra = (ctx.overrides ?? []).find(
          (o) => o.kind === 'extra_week' && overrideActive(o, ctx.planDate),
        )
        const plan = buildPlan(ctx)
        expect(plan.tracks.dsa?.extraWeek).toBe(extra?.key)
        if (extra === undefined) return
        for (const block of plan.blocks) {
          expect(block.kind).not.toBe('new')
          for (const planned of block.items) {
            if (planned.mode !== 'new') continue
            // Only lessons (deep-dive leads), practice prompts and custom items may be new.
            const item = ctx.catalog.items[planned.itemId]
            const core = LAB_ROADMAP.weeks.flatMap((week) => coreItemsOfWeek(week, ctx.catalog))
            expect(core, planned.itemId).not.toContain(item?.id)
          }
        }
      }),
      RUNS,
    )
  })

  it('without overrides (or with none accepted) the plan is the baseline plan', () => {
    fc.assert(
      fc.property(scenarioArb, ({ ctx }) => {
        const { planDate, catalog, enrollments, items, recapDone } = ctx
        const baseline: PlanContext = { planDate, catalog, enrollments, items, recapDone }
        expect(buildPlan({ ...baseline, overrides: [] })).toStrictEqual(buildPlan(baseline))
      }),
      RUNS,
    )
  })
})
