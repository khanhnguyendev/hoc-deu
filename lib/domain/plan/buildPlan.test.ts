import { describe, expect, it } from 'vitest'
import type { ItemMode, PlanCatalog, PlanItem, PlanRoadmap, PlanWeeklyTemplate } from '../catalog'
import type { ItemState } from '../state'
import { addDays, type LocalDay } from '../time/localDay'
import {
  CATALOG,
  DSA_TEMPLATE,
  EMPTY_CATALOG,
  ENGLISH_10W,
  ENGLISH_SRS,
  ENGLISH_TEMPLATE,
  ENGLISH_TRACK,
  enrollment,
  itemState,
  MONDAY,
  planContext,
  planItem,
  SATURDAY,
  statesOf,
  SUNDAY,
  withItems,
} from './__tests__/fixtures'
import { buildPlan, checkInMinutes, largestItemMinutes, plannedMinutes } from './buildPlan'
import type { DayPlan, PlanBlock, PlanBlockItem, PlanContext } from './types'

const LAST_WEEK = '2026-09-21'

const CARD_MINUTES: Record<ItemMode, number> = {
  new: 1.5,
  review: 0.5,
  recall: 0.5,
  redo: 0.5,
  'explain-aloud': 0.5,
}

/** An introduced item due on `dueOn` (a level-1 success from last week by default). */
const due = (itemId: string, dueOn: LocalDay, state: Partial<ItemState> = {}): ItemState =>
  itemState(itemId, LAST_WEEK, { dueOn, ...state })

const item = (itemId: string, mode: ItemMode, minutes: number): PlanBlockItem => ({
  itemId,
  mode,
  minutes,
})

const cards = (ids: readonly string[], mode: ItemMode = 'new'): PlanBlockItem[] =>
  ids.map((id) => item(`english:${id}`, mode, CARD_MINUTES[mode]))

const blocksOf = (plan: DayPlan, trackId: string): readonly PlanBlock[] =>
  plan.blocks.filter((block) => block.trackId === trackId)

const itemIdsOf = (plan: DayPlan): string[] =>
  plan.blocks.flatMap((block) => block.items.map((planned) => planned.itemId))

const dsaOnly = (change: Partial<PlanContext> = {}, dsa = enrollment('dsa')): PlanContext =>
  planContext({ enrollments: [dsa], ...change })

const englishOnly = (change: Partial<PlanContext> = {}, english = enrollment('english')) =>
  planContext({ enrollments: [english], ...change })

describe('buildPlan — new learner, weekday (platform design §5.4)', () => {
  it('DSA Monday, 60 min → one new block: the lesson (25) and p1 (20); p2 fails half-fit', () => {
    expect(buildPlan(dsaOnly())).toStrictEqual({
      planDate: MONDAY,
      mode: 'baseline',
      blocks: [
        {
          id: '2026-09-28:dsa:new:1',
          trackId: 'dsa',
          kind: 'new',
          estMinutes: 45,
          items: [item('dsa:lesson-arrays', 'new', 25), item('dsa:p1', 'new', 20)],
        },
      ],
      tracks: {
        dsa: {
          variant: '8w',
          week: 1,
          dueCount: 0,
          newPerDay: null,
          throttled: false,
          reviewDebt: false,
        },
      },
    })
  })

  it('English Monday, 25 min → exercise, shadowing and eight new cards (newPerDay)', () => {
    const plan = buildPlan(englishOnly())
    expect(plan.blocks).toStrictEqual([
      {
        id: '2026-09-28:english:practice:1',
        trackId: 'english',
        kind: 'practice',
        estMinutes: 5,
        itemType: 'exercise',
        items: [item('english:ex-w1-a', 'new', 5)],
      },
      {
        id: '2026-09-28:english:practice:2',
        trackId: 'english',
        kind: 'practice',
        estMinutes: 3,
        tag: 'shadowing',
        items: [],
        shadowing: ['english:e1', 'english:e2', 'english:x1'],
      },
      {
        id: '2026-09-28:english:new:1',
        trackId: 'english',
        kind: 'new',
        estMinutes: 12,
        // Derived cards stay locked: no DSA results.
        items: cards(['e1', 'e2', 'e3', 'e4', 'x1', 'x2', 'e5', 'e6']),
      },
    ])
    expect(plan.tracks).toStrictEqual({
      english: {
        variant: '10w',
        week: 1,
        dueCount: 0,
        newPerDay: 8,
        throttled: false,
        reviewDebt: false,
      },
    })
  })

  it('both tracks → blocks in trackId order, one snapshot per track', () => {
    const plan = buildPlan(planContext({ enrollments: [enrollment('english'), enrollment('dsa')] }))
    expect(plan.blocks.map((block) => block.id)).toEqual([
      '2026-09-28:dsa:new:1',
      '2026-09-28:english:practice:1',
      '2026-09-28:english:practice:2',
      '2026-09-28:english:new:1',
    ])
    expect(Object.keys(plan.tracks)).toEqual(['dsa', 'english'])
  })
})

describe('buildPlan — review cap and review debt (§5.4 step 3, §5.10)', () => {
  const SIX = ['dsa:p1', 'dsa:p2', 'dsa:p3', 'dsa:p4', 'dsa:p5', 'dsa:p6']

  it('six due recall items (5 min) on a weekday → a review block of three (cap 15)', () => {
    const plan = buildPlan(dsaOnly({ items: statesOf(...SIX.map((id) => due(id, MONDAY))) }))
    expect(blocksOf(plan, 'dsa')[0]).toStrictEqual({
      id: '2026-09-28:dsa:review:1',
      trackId: 'dsa',
      kind: 'review',
      estMinutes: 15,
      items: [
        item('dsa:p1', 'recall', 5),
        item('dsa:p2', 'recall', 5),
        item('dsa:p3', 'recall', 5),
      ],
    })
    expect(plan.tracks.dsa).toMatchObject({ dueCount: 6, reviewDebt: false })
  })

  it('one of them 8 days overdue → debt: cap 24 → four items (20); the fifth would need 25', () => {
    const items = statesOf(
      ...SIX.map((id) => due(id, id === 'dsa:p6' ? addDays(MONDAY, -8) : MONDAY)),
    )
    const plan = buildPlan(dsaOnly({ items }))
    expect(blocksOf(plan, 'dsa')[0]).toStrictEqual({
      id: '2026-09-28:dsa:review:1',
      trackId: 'dsa',
      kind: 'review',
      estMinutes: 20,
      items: [
        item('dsa:p6', 'recall', 5),
        item('dsa:p1', 'recall', 5),
        item('dsa:p2', 'recall', 5),
        item('dsa:p3', 'recall', 5),
      ],
    })
    expect(plan.tracks.dsa).toMatchObject({ dueCount: 6, reviewDebt: true })
  })

  it('exactly 7 days overdue is not debt → three items', () => {
    const items = statesOf(
      ...SIX.map((id) => due(id, id === 'dsa:p6' ? addDays(MONDAY, -7) : MONDAY)),
    )
    const plan = buildPlan(dsaOnly({ items }))
    expect(blocksOf(plan, 'dsa')[0]?.items).toHaveLength(3)
    expect(plan.tracks.dsa?.reviewDebt).toBe(false)
  })
})

describe('buildPlan — deep-dive lesson before its Weak problem (§5.4 step 3)', () => {
  const weakP3 = (day: LocalDay) => statesOf(due('dsa:p3', day, { weak: true, status: 'weak' }))

  it('Saturday: the deep-dive lesson right before p3 (redo) when both fit', () => {
    const plan = buildPlan(dsaOnly({ planDate: SATURDAY, items: weakP3(SATURDAY) }))
    expect(blocksOf(plan, 'dsa')[0]).toStrictEqual({
      id: '2026-10-03:dsa:review:1',
      trackId: 'dsa',
      kind: 'review',
      estMinutes: 46,
      items: [item('dsa:lesson-deep-dive-p3', 'new', 25), item('dsa:p3', 'redo', 21)],
    })
  })

  it('weekday (cap 15): the lesson and p3 (46) are skipped together', () => {
    const plan = buildPlan(dsaOnly({ items: weakP3(MONDAY) }))
    expect(plan.blocks.some((block) => block.kind === 'review')).toBe(false)
    expect(itemIdsOf(plan)).not.toContain('dsa:p3')
    expect(itemIdsOf(plan)).not.toContain('dsa:lesson-deep-dive-p3')
  })

  it('a completed deep-dive → p3 alone', () => {
    const items = {
      ...weakP3(SATURDAY),
      ...statesOf(itemState('dsa:lesson-deep-dive-p3', LAST_WEEK)),
    }
    const plan = buildPlan(dsaOnly({ planDate: SATURDAY, items }))
    expect(blocksOf(plan, 'dsa')[0]?.items).toStrictEqual([item('dsa:p3', 'redo', 21)])
  })

  it('a draft deep-dive → p3 alone', () => {
    const catalog = withItems(CATALOG, { 'dsa:lesson-deep-dive-p3': { status: 'draft' } })
    const plan = buildPlan(dsaOnly({ planDate: SATURDAY, catalog, items: weakP3(SATURDAY) }))
    expect(blocksOf(plan, 'dsa')[0]?.items).toStrictEqual([item('dsa:p3', 'redo', 21)])
  })

  it('a p3 that is due but not Weak gets no deep-dive (quick recall)', () => {
    const plan = buildPlan(
      dsaOnly({ planDate: SATURDAY, items: statesOf(due('dsa:p3', SATURDAY)) }),
    )
    expect(blocksOf(plan, 'dsa')[0]?.items).toStrictEqual([item('dsa:p3', 'recall', 5)])
  })
})

describe('buildPlan — English throttle (§5.5)', () => {
  const EXTRA: readonly PlanItem[] = Array.from({ length: 70 }, (_, index) =>
    planItem({
      id: `english:c${String(index).padStart(2, '0')}`,
      trackId: 'english',
      itemType: 'flashcard',
      topicId: 'standup',
      week: 1,
      srs: ENGLISH_SRS,
      minutes: CARD_MINUTES,
      tier: 'core',
    }),
  )
  const catalog: PlanCatalog = {
    ...CATALOG,
    items: { ...CATALOG.items, ...Object.fromEntries(EXTRA.map((card) => [card.id, card])) },
  }
  const dueCards = (count: number) =>
    statesOf(
      ...EXTRA.slice(0, count).map((card) =>
        itemState(card.id, LAST_WEEK, { dueOn: MONDAY }, catalog),
      ),
    )
  const newSrsItems = (plan: DayPlan) =>
    plan.blocks
      .filter((block) => block.kind === 'new')
      .flatMap((block) => block.items)
      .filter((planned) => catalog.items[planned.itemId]?.srs !== null)

  it('45 due cards → newPerDay 4, throttled, at most 4 new SRS cards', () => {
    const plan = buildPlan(
      englishOnly({ catalog, items: dueCards(45) }, enrollment('english', { budgetMinutes: 60 })),
    )
    expect(plan.tracks.english).toStrictEqual({
      variant: '10w',
      week: 1,
      dueCount: 45,
      newPerDay: 4,
      throttled: true,
      reviewDebt: false,
    })
    // The budget alone would take all eight: the cap is what stops the new block at four.
    expect(newSrsItems(plan).map((planned) => planned.itemId)).toEqual([
      'english:e1',
      'english:e2',
      'english:e3',
      'english:e4',
    ])
  })

  it('45 due cards on the default 25 minutes → the reviews fill the budget, one forced card (≤ 4)', () => {
    const plan = buildPlan(englishOnly({ catalog, items: dueCards(45) }))
    expect(plan.tracks.english).toMatchObject({ newPerDay: 4, throttled: true })
    expect(newSrsItems(plan)).toStrictEqual([
      { itemId: 'english:e1', mode: 'new', minutes: 1.5, overBudget: true },
    ])
  })

  it('61 due cards → newPerDay 0: no new card at all and no first-item overshoot', () => {
    const plan = buildPlan(
      englishOnly({ catalog, items: dueCards(61) }, enrollment('english', { budgetMinutes: 60 })),
    )
    expect(plan.tracks.english).toMatchObject({ dueCount: 61, newPerDay: 0, throttled: true })
    expect(plan.blocks.some((block) => block.kind === 'new')).toBe(false)
    expect(plan.blocks.flatMap((block) => block.items).some((p) => p.overBudget)).toBe(false)
  })

  it('61 due cards on the default 25 minutes → still no new card', () => {
    const plan = buildPlan(englishOnly({ catalog, items: dueCards(61) }))
    expect(newSrsItems(plan)).toEqual([])
  })
})

describe('buildPlan — one overshoot per track (§5.4, decision 13)', () => {
  it('DSA budget 10 on a weekday, nothing due → the lesson (25) is taken over budget, nothing else', () => {
    const plan = buildPlan(dsaOnly({}, enrollment('dsa', { budgetMinutes: 10 })))
    expect(plan.blocks).toStrictEqual([
      {
        id: '2026-09-28:dsa:new:1',
        trackId: 'dsa',
        kind: 'new',
        estMinutes: 25,
        items: [{ itemId: 'dsa:lesson-arrays', mode: 'new', minutes: 25, overBudget: true }],
      },
    ])
  })

  const mockFromWeek1: PlanWeeklyTemplate = {
    ...DSA_TEMPLATE,
    sun: [
      { kind: 'practice', tag: 'mock-interview', minutes: 45, fromWeek: 1 },
      { kind: 'recap', count: 3 },
    ],
  }
  const mockBlock: PlanBlock = {
    id: '2026-10-04:dsa:practice:1',
    trackId: 'dsa',
    kind: 'practice',
    estMinutes: 45,
    tag: 'mock-interview',
    items: [item('dsa:prompt-mock', 'new', 45)],
  }
  const sunday30 = enrollment('dsa', { budgetMinutes: 30, weeklyTemplate: mockFromWeek1 })

  it('Sunday, budget 30, mock interview from week 1 → the mock (45) is the overshoot; the recap and its new fallback get nothing', () => {
    const plan = buildPlan(dsaOnly({ planDate: SUNDAY }, sunday30))
    expect(plan.blocks).toStrictEqual([mockBlock])
    expect(plannedMinutes(plan, 'dsa')).toBe(45)
    expect(plannedMinutes(plan, 'dsa')).toBeLessThanOrEqual(30 + largestItemMinutes(plan, 'dsa'))
  })

  it('… also when the recap has an item it would otherwise force (p1 introduced)', () => {
    const items = statesOf(due('dsa:p1', addDays(SUNDAY, 3)))
    const plan = buildPlan(dsaOnly({ planDate: SUNDAY, items }, sunday30))
    expect(plan.blocks).toStrictEqual([mockBlock])
  })

  it('a fixed block that does not fit after the overshoot is dropped', () => {
    const template: PlanWeeklyTemplate = {
      'mon-fri': [
        { kind: 'practice', tag: 'weekend-task', minutes: 15 },
        { kind: 'practice', itemType: 'exercise', minutes: 5 },
      ],
    }
    const plan = buildPlan(
      englishOnly({}, enrollment('english', { budgetMinutes: 10, weeklyTemplate: template })),
    )
    expect(plan.blocks).toStrictEqual([
      {
        id: '2026-09-28:english:practice:1',
        trackId: 'english',
        kind: 'practice',
        estMinutes: 15,
        tag: 'weekend-task',
        items: [item('english:prompt-w1', 'new', 15)],
      },
    ])
  })
})

describe('buildPlan — Sunday recap (§5.6)', () => {
  const p1to3 = statesOf(
    ...['dsa:p1', 'dsa:p2', 'dsa:p3'].map((id) => itemState(id, MONDAY, { dueOn: '2026-10-05' })),
  )

  it('p1–p3 introduced, no recap done → week 1: p2 redo, p1 explain-aloud, then p3 as filler', () => {
    const plan = buildPlan(dsaOnly({ planDate: SUNDAY, items: p1to3 }))
    expect(plan.blocks).toStrictEqual([
      {
        id: '2026-10-04:dsa:recap:1',
        trackId: 'dsa',
        kind: 'recap',
        estMinutes: 31,
        recapWeek: 1,
        items: [
          item('dsa:p2', 'redo', 21),
          item('dsa:p1', 'explain-aloud', 5),
          item('dsa:p3', 'recall', 5),
        ],
      },
    ])
    expect(plan.tracks.dsa?.week).toBe(2)
  })

  it("week 1's recap done → filler only, recapWeek null", () => {
    const plan = buildPlan(
      dsaOnly({ planDate: SUNDAY, items: p1to3, recapDone: { dsa: new Set([1]) } }),
    )
    expect(plan.blocks).toStrictEqual([
      {
        id: '2026-10-04:dsa:recap:1',
        trackId: 'dsa',
        kind: 'recap',
        estMinutes: 15,
        recapWeek: null,
        items: [
          item('dsa:p1', 'recall', 5),
          item('dsa:p2', 'recall', 5),
          item('dsa:p3', 'recall', 5),
        ],
      },
    ])
  })

  it('a source week none of whose recap entries can be picked → filler only, recapWeek null', () => {
    const catalog = withItems(CATALOG, {
      'dsa:p1': { status: 'retired' },
      'dsa:p2': { status: 'retired' },
    })
    const plan = buildPlan(dsaOnly({ planDate: SUNDAY, catalog, items: p1to3 }))
    expect(plan.blocks).toStrictEqual([
      {
        id: '2026-10-04:dsa:recap:1',
        trackId: 'dsa',
        kind: 'recap',
        estMinutes: 5,
        recapWeek: null,
        items: [item('dsa:p3', 'recall', 5)],
      },
    ])
  })

  it('the first recap item is forced when it does not fit (and flagged)', () => {
    const plan = buildPlan(
      dsaOnly({ planDate: SUNDAY, items: p1to3 }, enrollment('dsa', { budgetMinutes: 10 })),
    )
    expect(plan.blocks).toStrictEqual([
      {
        id: '2026-10-04:dsa:recap:1',
        trackId: 'dsa',
        kind: 'recap',
        estMinutes: 21,
        recapWeek: 1,
        items: [{ itemId: 'dsa:p2', mode: 'redo', minutes: 21, overBudget: true }],
      },
    ])
  })
})

describe('buildPlan — days without a new block (§5.4 steps 6–7, RF-4, decision 26)', () => {
  it('new learner on Saturday → review empty → filler empty → a new block [lesson, p1]', () => {
    const plan = buildPlan(dsaOnly({ planDate: SATURDAY }))
    expect(plan.blocks).toStrictEqual([
      {
        id: '2026-10-03:dsa:new:1',
        trackId: 'dsa',
        kind: 'new',
        estMinutes: 45,
        items: [item('dsa:lesson-arrays', 'new', 25), item('dsa:p1', 'new', 20)],
      },
    ])
  })

  it('an introduced learner with nothing due on Saturday → the review falls back to a filler recap', () => {
    const items = statesOf(due('dsa:p1', addDays(SATURDAY, 4)), due('dsa:p2', addDays(SATURDAY, 4)))
    const plan = buildPlan(dsaOnly({ planDate: SATURDAY, items }))
    expect(plan.blocks[0]).toStrictEqual({
      id: '2026-10-03:dsa:recap:1',
      trackId: 'dsa',
      kind: 'recap',
      estMinutes: 10,
      recapWeek: null,
      items: [item('dsa:p1', 'recall', 5), item('dsa:p2', 'recall', 5)],
    })
    // The filler recap is not a new block: the leftover still spills into new items, last.
    expect(plan.blocks.map((block) => block.id)).toEqual([
      '2026-10-03:dsa:recap:1',
      '2026-10-03:dsa:new:1',
    ])
  })

  it('two recall reviews due on Saturday (60 min) → review (10), then a spill new block (half-fit, never forced)', () => {
    const items = statesOf(due('dsa:p1', SATURDAY), due('dsa:p2', SATURDAY))
    const plan = buildPlan(dsaOnly({ planDate: SATURDAY, items }))
    expect(plan.blocks).toStrictEqual([
      {
        id: '2026-10-03:dsa:review:1',
        trackId: 'dsa',
        kind: 'review',
        estMinutes: 10,
        items: [item('dsa:p1', 'recall', 5), item('dsa:p2', 'recall', 5)],
      },
      {
        id: '2026-10-03:dsa:new:1',
        trackId: 'dsa',
        kind: 'new',
        estMinutes: 60,
        // 50 left: the lesson (25) fits; p3 (35) half-fits with 25 left; p4 (50) does not.
        items: [item('dsa:lesson-arrays', 'new', 25), item('dsa:p3', 'new', 35)],
      },
    ])
  })

  // Ruling M4-R9: only the track's first new selection of the day forces its first item — here
  // the first review block's fallback. The second fallback finds p2 (20) over the 15 minutes left
  // and forces nothing, so there is no second new block.
  it('Saturday [review, review], new learner, 60 min → one new block [lesson, p1]; the second fallback forces nothing (M4-R9)', () => {
    const template: PlanWeeklyTemplate = { sat: [{ kind: 'review' }, { kind: 'review' }] }
    const plan = buildPlan(
      dsaOnly(
        { planDate: SATURDAY },
        enrollment('dsa', { budgetMinutes: 60, weeklyTemplate: template }),
      ),
    )
    expect(plan.blocks).toStrictEqual([
      {
        id: '2026-10-03:dsa:new:1',
        trackId: 'dsa',
        kind: 'new',
        estMinutes: 45,
        items: [item('dsa:lesson-arrays', 'new', 25), item('dsa:p1', 'new', 20)],
      },
    ])
  })

  it('the spill never forces its first item: 10 minutes left → no new block', () => {
    const items = statesOf(due('dsa:p1', SATURDAY), due('dsa:p2', SATURDAY))
    const plan = buildPlan(
      dsaOnly({ planDate: SATURDAY, items }, enrollment('dsa', { budgetMinutes: 20 })),
    )
    expect(plan.blocks.map((block) => block.kind)).toEqual(['review'])
  })

  it('English Sunday, new learner → weekend prompt w1 (15); the empty review falls back to 7 new cards', () => {
    const plan = buildPlan(englishOnly({ planDate: SUNDAY }))
    expect(plan.blocks).toStrictEqual([
      {
        id: '2026-10-04:english:practice:1',
        trackId: 'english',
        kind: 'practice',
        estMinutes: 15,
        tag: 'weekend-task',
        items: [item('english:prompt-w1', 'new', 15)],
      },
      {
        id: '2026-10-04:english:new:1',
        trackId: 'english',
        kind: 'new',
        estMinutes: 10.5,
        // 10 left: six cards fit (9), the seventh half-fits with 1 left, the eighth does not.
        items: cards(['e1', 'e2', 'e3', 'e4', 'x1', 'x2', 'e5']),
      },
    ])
  })

  it('English Sunday, four due cards → prompt, review (2 minutes), then a spill new block', () => {
    const items = statesOf(
      ...['english:e1', 'english:e2', 'english:x1', 'english:x2'].map((id) => due(id, SUNDAY)),
    )
    const plan = buildPlan(englishOnly({ planDate: SUNDAY, items }))
    expect(plan.blocks).toStrictEqual([
      {
        id: '2026-10-04:english:practice:1',
        trackId: 'english',
        kind: 'practice',
        estMinutes: 15,
        tag: 'weekend-task',
        items: [item('english:prompt-w1', 'new', 15)],
      },
      {
        id: '2026-10-04:english:review:1',
        trackId: 'english',
        kind: 'review',
        estMinutes: 2,
        items: cards(['e1', 'e2', 'x1', 'x2'], 'review'),
      },
      {
        id: '2026-10-04:english:new:1',
        trackId: 'english',
        kind: 'new',
        estMinutes: 6,
        items: cards(['e3', 'e4', 'e5', 'e6']),
      },
    ])
  })

  it('English Sunday with every weekend prompt done → the prompt block is dropped before its minutes are reserved (decision 14)', () => {
    const items = statesOf(
      itemState('english:prompt-w1', LAST_WEEK),
      itemState('english:prompt-w2', LAST_WEEK),
    )
    const plan = buildPlan(englishOnly({ planDate: SUNDAY, items }))
    expect(plan.blocks).toStrictEqual([
      {
        id: '2026-10-04:english:new:1',
        trackId: 'english',
        kind: 'new',
        estMinutes: 12,
        items: cards(['e1', 'e2', 'e3', 'e4', 'x1', 'x2', 'e5', 'e6']),
      },
    ])
  })

  it('an empty recap block falls back to new items, the first one forced', () => {
    const plan = buildPlan(dsaOnly({ planDate: SUNDAY }))
    expect(plan.blocks).toStrictEqual([
      {
        id: '2026-10-04:dsa:new:1',
        trackId: 'dsa',
        kind: 'new',
        estMinutes: 45,
        items: [item('dsa:lesson-arrays', 'new', 25), item('dsa:p1', 'new', 20)],
      },
    ])
  })
})

describe('buildPlan — template details', () => {
  it('two new blocks share the new-item cap', () => {
    const template: PlanWeeklyTemplate = { 'mon-fri': [{ kind: 'new' }, { kind: 'new' }] }
    const plan = buildPlan(
      englishOnly(
        {},
        enrollment('english', { budgetMinutes: 60, newPerDay: 3, weeklyTemplate: template }),
      ),
    )
    expect(plan.blocks).toStrictEqual([
      {
        id: '2026-09-28:english:new:1',
        trackId: 'english',
        kind: 'new',
        estMinutes: 4.5,
        items: cards(['e1', 'e2', 'e3']),
      },
    ])
  })

  it('a practice pick already in the plan is not placed twice', () => {
    const template: PlanWeeklyTemplate = {
      sun: [
        { kind: 'practice', tag: 'mock-interview', minutes: 45 },
        { kind: 'practice', tag: 'mock-interview', minutes: 45 },
      ],
    }
    const plan = buildPlan(
      dsaOnly(
        { planDate: SUNDAY },
        enrollment('dsa', { budgetMinutes: 120, weeklyTemplate: template }),
      ),
    )
    expect(plan.blocks.filter((block) => block.kind === 'practice')).toHaveLength(1)
    expect(itemIdsOf(plan).filter((id) => id === 'dsa:prompt-mock')).toHaveLength(1)
  })

  it('a practice block with an unknown tag is dropped', () => {
    const template: PlanWeeklyTemplate = {
      'mon-fri': [{ kind: 'practice', tag: 'no-such-tag', minutes: 10 }],
    }
    const plan = buildPlan(dsaOnly({}, enrollment('dsa', { weeklyTemplate: template })))
    expect(plan.blocks.some((block) => block.kind === 'practice')).toBe(false)
    // Neither a new nor a recap block: the whole budget spills into new items.
    expect(plan.blocks.map((block) => block.id)).toEqual(['2026-09-28:dsa:new:1'])
  })

  it('an introduced practice item is placed in review mode', () => {
    const template: PlanWeeklyTemplate = {
      'mon-fri': [{ kind: 'practice', itemType: 'exercise', minutes: 5 }],
    }
    const items = statesOf(
      itemState('english:ex-w1-a', LAST_WEEK, { lastResult: 'miss' }),
      itemState('english:ex-w1-b', LAST_WEEK, { lastResult: 'pass' }),
    )
    const plan = buildPlan(
      englishOnly({ items }, enrollment('english', { weeklyTemplate: template })),
    )
    expect(plan.blocks[0]?.items).toStrictEqual([item('english:ex-w1-a', 'review', 5)])
  })

  it('shadowing without new cards uses the most recently introduced cards; none at all → dropped', () => {
    const introduced = statesOf(
      itemState('english:e1', '2026-09-20', { dueOn: '2026-10-10' }),
      itemState('english:e2', '2026-09-22', { dueOn: '2026-10-10' }),
    )
    const shadowOnly: PlanWeeklyTemplate = {
      'mon-fri': [{ kind: 'practice', tag: 'shadowing', minutes: 3 }],
    }
    // newPerDay 0: the spill adds no new card, so shadowing has none of today's to read.
    const noNew = enrollment('english', { weeklyTemplate: shadowOnly, newPerDay: 0 })
    const withCards = buildPlan(englishOnly({ items: introduced }, noNew))
    expect(withCards.blocks).toStrictEqual([
      {
        id: '2026-09-28:english:practice:1',
        trackId: 'english',
        kind: 'practice',
        estMinutes: 3,
        tag: 'shadowing',
        items: [],
        shadowing: ['english:e2', 'english:e1'],
      },
    ])
    const without = buildPlan(englishOnly({}, noNew))
    expect(without.blocks).toEqual([])
  })
})

describe('buildPlan — content holes and enrollments (RF-4)', () => {
  it('empty catalog → no blocks, no tracks', () => {
    expect(buildPlan(planContext({ catalog: EMPTY_CATALOG }))).toStrictEqual({
      planDate: MONDAY,
      mode: 'baseline',
      blocks: [],
      tracks: {},
    })
  })

  it('a track whose startDate is in the future is skipped; one starting today is not', () => {
    const plan = buildPlan(
      planContext({
        enrollments: [enrollment('dsa', { startDate: '2026-09-29' }), enrollment('english')],
      }),
    )
    expect(Object.keys(plan.tracks)).toEqual(['english'])
    expect(plan.blocks.every((block) => block.trackId === 'english')).toBe(true)
  })

  it('a paused or removed enrollment is skipped', () => {
    const plan = buildPlan(
      planContext({
        enrollments: [
          enrollment('dsa', { status: 'paused' }),
          enrollment('english', { status: 'removed' }),
        ],
      }),
    )
    expect(plan.blocks).toEqual([])
    expect(plan.tracks).toEqual({})
  })

  it('a track that is not active in the catalog is skipped', () => {
    const catalog: PlanCatalog = {
      ...CATALOG,
      tracks: { ...CATALOG.tracks, english: { ...ENGLISH_TRACK, status: 'draft' } },
    }
    const plan = buildPlan(planContext({ catalog }))
    expect(Object.keys(plan.tracks)).toEqual(['dsa'])
  })

  it('Monday, a variant without a roadmap file → reviews only (no new, no recap)', () => {
    const items = statesOf(due('dsa:p1', MONDAY))
    const plan = buildPlan(dsaOnly({ items }, enrollment('dsa', { variant: '10w' })))
    expect(plan.blocks).toStrictEqual([
      {
        id: '2026-09-28:dsa:review:1',
        trackId: 'dsa',
        kind: 'review',
        estMinutes: 5,
        items: [item('dsa:p1', 'recall', 5)],
      },
    ])
    expect(plan.tracks.dsa).toMatchObject({ variant: '10w', week: 1, dueCount: 1 })
  })

  it('English week 3 without exercises → no exercise block', () => {
    const roadmap: PlanRoadmap = {
      ...ENGLISH_10W,
      weeks: [
        ...ENGLISH_10W.weeks,
        {
          week: 3,
          topics: ['meetings'],
          core: [],
          bonus: [],
          recap: [],
          decks: ['english:deck-w3'],
        },
      ],
    }
    const w3Card = planItem({
      id: 'english:w3-card',
      trackId: 'english',
      itemType: 'flashcard',
      topicId: 'meetings',
      week: 3,
      srs: ENGLISH_SRS,
      minutes: CARD_MINUTES,
      tier: 'core',
      deckId: 'english:deck-w3',
      hasExample: true,
    })
    const catalog: PlanCatalog = {
      tracks: { ...CATALOG.tracks, english: { ...ENGLISH_TRACK, roadmaps: { '10w': roadmap } } },
      items: { ...CATALOG.items, [w3Card.id]: w3Card },
      decks: {
        ...CATALOG.decks,
        'english:deck-w3': {
          id: 'english:deck-w3',
          trackId: 'english',
          status: 'active',
          cardIds: [w3Card.id],
        },
      },
    }
    const items = statesOf(
      ...['e1', 'e2', 'e3', 'e4', 'e5', 'e6'].map((id) =>
        itemState(`english:${id}`, LAST_WEEK, { dueOn: '2026-10-10' }),
      ),
    )
    const plan = buildPlan(englishOnly({ catalog, items }))
    expect(plan.tracks.english?.week).toBe(3)
    expect(plan.blocks.some((block) => block.itemType === 'exercise')).toBe(false)
    expect(blocksOf(plan, 'english').map((block) => block.id)).toEqual([
      '2026-09-28:english:practice:1',
      '2026-09-28:english:new:1',
    ])
    expect(blocksOf(plan, 'english')[0]?.tag).toBe('shadowing')
  })
})

describe('plannedMinutes / largestItemMinutes / checkInMinutes', () => {
  const block = (
    id: string,
    trackId: string,
    kind: PlanBlock['kind'],
    estMinutes: number,
    items: PlanBlockItem[],
  ): PlanBlock => ({ id, trackId, kind, estMinutes, items })

  const plan = {
    blocks: [
      block('d:dsa:review:1', 'dsa', 'review', 10, [
        item('dsa:p1', 'recall', 5),
        item('dsa:p2', 'recall', 5),
      ]),
      block('d:dsa:new:1', 'dsa', 'new', 55, [
        item('dsa:lesson-arrays', 'new', 25),
        item('dsa:p3', 'new', 35),
      ]),
      { ...block('d:english:practice:1', 'english', 'practice', 3, []), shadowing: ['english:e1'] },
      block('d:english:review:1', 'english', 'review', 1.5, cards(['e1', 'e2', 'e3'], 'review')),
    ],
  }

  it('plannedMinutes sums the track’s blocks', () => {
    expect(plannedMinutes(plan, 'dsa')).toBe(65)
    expect(plannedMinutes(plan, 'english')).toBe(4.5)
    expect(plannedMinutes(plan, 'none')).toBe(0)
  })

  it('largestItemMinutes is the max over items and practice-block minutes', () => {
    expect(largestItemMinutes(plan, 'dsa')).toBe(35)
    expect(largestItemMinutes(plan, 'english')).toBe(3)
    expect(largestItemMinutes(plan, 'none')).toBe(0)
  })

  it('checkInMinutes: three 0.5-minute reviews → 2; a 45-minute block → 45; one card → 1', () => {
    expect(checkInMinutes(plan.blocks[3]!)).toBe(2)
    expect(
      checkInMinutes(
        block('d:dsa:practice:1', 'dsa', 'practice', 45, [item('dsa:prompt-mock', 'new', 45)]),
      ),
    ).toBe(45)
    expect(
      checkInMinutes(
        block('d:english:review:1', 'english', 'review', 0.5, cards(['e1'], 'review')),
      ),
    ).toBe(1)
  })
})

/** Object.freeze all the way down (Sets are frozen as objects; their contents are compared). */
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value)) deepFreeze(child)
  }
  return value
}

describe('buildPlan — determinism and immutability', () => {
  const context = (): PlanContext =>
    planContext({
      planDate: SATURDAY,
      items: statesOf(
        due('dsa:p1', SATURDAY),
        due('dsa:p3', addDays(SATURDAY, -9), { weak: true, status: 'weak' }),
        due('english:e1', SATURDAY),
        itemState('english:ex-w1-a', LAST_WEEK),
      ),
      recapDone: { dsa: new Set([1]) },
      enrollments: [enrollment('dsa'), enrollment('english', { weeklyTemplate: ENGLISH_TEMPLATE })],
    })

  it('the same context twice → deep-equal plans', () => {
    expect(buildPlan(context())).toStrictEqual(buildPlan(context()))
  })

  it('frozen inputs are never modified', () => {
    const ctx = deepFreeze(context())
    const before = structuredClone(ctx)
    const first = buildPlan(ctx)
    expect(ctx).toStrictEqual(before)
    expect(buildPlan(ctx)).toStrictEqual(first)
    for (const day of [MONDAY, SUNDAY]) {
      expect(() => buildPlan({ ...ctx, planDate: day })).not.toThrow()
    }
    expect(ctx).toStrictEqual(before)
  })
})
