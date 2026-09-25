import { describe, expect, it } from 'vitest'
import type { ItemMode } from '../catalog'
import type { ItemState } from '../state'
import type { LocalDay } from '../time/localDay'
import {
  CATALOG,
  enrollment,
  itemState,
  MONDAY,
  planContext,
  SATURDAY,
  statesOf,
  SUNDAY,
  withItems,
} from './__tests__/fixtures'
import { buildResumePlan } from './resume'
import type { PlanBlock, PlanBlockItem, StoredPlan } from './types'

const STALE_DAY = '2026-09-24'

const item = (itemId: string, mode: ItemMode, minutes: number): PlanBlockItem => ({
  itemId,
  mode,
  minutes,
})

const due = (itemId: string, dueOn: LocalDay, state: Partial<ItemState> = {}): ItemState =>
  itemState(itemId, '2026-09-14', { dueOn, ...state })

const newBlock = (trackId: string, itemIds: readonly string[]): PlanBlock => ({
  id: `${STALE_DAY}:${trackId}:new:1`,
  trackId,
  kind: 'new',
  estMinutes: 0,
  items: itemIds.map((itemId) => item(itemId, 'new', 1)),
})

/** A seen plan from four days ago, never checked in. */
const stalePlan = (blocks: readonly PlanBlock[]): StoredPlan => ({
  id: 'stale-plan',
  planDate: STALE_DAY,
  version: 1,
  source: 'baseline',
  seenAt: '2026-09-24T02:00:00Z',
  blocks,
  tracks: {},
})

const STALE = stalePlan([
  newBlock('dsa', ['dsa:lesson-arrays', 'dsa:p1', 'dsa:p2']),
  {
    id: `${STALE_DAY}:english:practice:1`,
    trackId: 'english',
    kind: 'practice',
    estMinutes: 5,
    itemType: 'exercise',
    items: [item('english:ex-w1-a', 'new', 5)],
  },
])

/** The lesson was studied since; p4 and an English card are due. */
const NOW = statesOf(
  itemState('dsa:lesson-arrays', STALE_DAY),
  due('dsa:p4', MONDAY),
  due('english:e1', MONDAY),
)

describe('buildResumePlan ("Học tiếp hôm nay", §5.8, decision 25, RF-5)', () => {
  it("the stale plan's not-yet-introduced new items, due reviews, mode 'resume'", () => {
    expect(buildResumePlan(planContext({ items: NOW }), STALE)).toStrictEqual({
      planDate: MONDAY,
      mode: 'resume',
      blocks: [
        {
          id: '2026-09-28:dsa:review:1',
          trackId: 'dsa',
          kind: 'review',
          estMinutes: 5,
          items: [item('dsa:p4', 'recall', 5)],
        },
        {
          id: '2026-09-28:dsa:new:1',
          trackId: 'dsa',
          kind: 'new',
          estMinutes: 55,
          // Never p3: the roadmap pointer does not advance past the stale plan's items.
          items: [item('dsa:p1', 'new', 20), item('dsa:p2', 'new', 35)],
        },
        {
          // No English new block: the stale plan had none (no practice either).
          id: '2026-09-28:english:review:1',
          trackId: 'english',
          kind: 'review',
          estMinutes: 0.5,
          items: [item('english:e1', 'review', 0.5)],
        },
      ],
      tracks: {
        dsa: {
          variant: '8w',
          week: 1,
          dueCount: 1,
          newPerDay: null,
          throttled: false,
          reviewDebt: false,
        },
        english: {
          variant: '10w',
          week: 1,
          dueCount: 1,
          newPerDay: 8,
          throttled: false,
          reviewDebt: false,
        },
      },
    })
  })

  it('as budget allows: items that do not fit stay not introduced (half-fit)', () => {
    const plan = buildResumePlan(
      planContext({ items: NOW, enrollments: [enrollment('dsa', { budgetMinutes: 30 })] }),
      STALE,
    )
    // 25 left after the review: p1 (20) fits, p2 (35) needs 17.5 of the 5 left.
    expect(plan.blocks.find((block) => block.kind === 'new')?.items).toStrictEqual([
      item('dsa:p1', 'new', 20),
    ])
  })

  it('the first new item is taken over budget while the overshoot is unused', () => {
    const plan = buildResumePlan(
      planContext({ enrollments: [enrollment('dsa', { budgetMinutes: 10 })] }),
      stalePlan([newBlock('dsa', ['dsa:p2', 'dsa:p3'])]),
    )
    expect(plan.blocks).toStrictEqual([
      {
        id: '2026-09-28:dsa:new:1',
        trackId: 'dsa',
        kind: 'new',
        estMinutes: 35,
        items: [{ itemId: 'dsa:p2', mode: 'new', minutes: 35, overBudget: true }],
      },
    ])
  })

  it("today's throttle applies to the stale new cards", () => {
    const plan = buildResumePlan(
      planContext({
        items: statesOf(itemState('english:e1', STALE_DAY, { dueOn: '2026-10-10' })),
        enrollments: [enrollment('english', { newPerDay: 1 })],
      }),
      stalePlan([newBlock('english', ['english:e1', 'english:e2', 'english:e3'])]),
    )
    expect(plan.blocks).toStrictEqual([
      {
        id: '2026-09-28:english:new:1',
        trackId: 'english',
        kind: 'new',
        estMinutes: 1.5,
        items: [item('english:e2', 'new', 1.5)],
      },
    ])
    expect(plan.tracks.english).toMatchObject({ newPerDay: 1, throttled: false })
  })

  it("the review cap is today's first review block's maxMinutes (Saturday: none)", () => {
    const ids = ['dsa:p1', 'dsa:p2', 'dsa:p3', 'dsa:p4']
    const items = statesOf(...ids.map((id) => due(id, MONDAY)))
    const monday = buildResumePlan(
      planContext({ planDate: MONDAY, items, enrollments: [enrollment('dsa')] }),
      stalePlan([]),
    )
    expect(monday.blocks).toStrictEqual([
      {
        id: '2026-09-28:dsa:review:1',
        trackId: 'dsa',
        kind: 'review',
        estMinutes: 15,
        items: ids.slice(0, 3).map((id) => item(id, 'recall', 5)),
      },
    ])
    const saturday = buildResumePlan(
      planContext({ planDate: SATURDAY, items, enrollments: [enrollment('dsa')] }),
      stalePlan([]),
    )
    expect(saturday.blocks).toStrictEqual([
      {
        id: '2026-10-03:dsa:review:1',
        trackId: 'dsa',
        kind: 'review',
        estMinutes: 20,
        items: ids.map((id) => item(id, 'recall', 5)),
      },
    ])
  })

  it('no practice, recap, fallback or spill: English Sunday with nothing due and no stale new block → no block', () => {
    const plan = buildResumePlan(
      planContext({ planDate: SUNDAY, enrollments: [enrollment('english')] }),
      STALE,
    )
    expect(plan.blocks).toEqual([])
    expect(Object.keys(plan.tracks)).toEqual(['english'])
  })

  it('stale items that are now retired, draft or missing from the catalog are left out', () => {
    const catalog = withItems(CATALOG, {
      'dsa:p1': { status: 'retired' },
      'dsa:p2': { status: 'draft' },
    })
    const plan = buildResumePlan(
      planContext({ catalog, enrollments: [enrollment('dsa')] }),
      stalePlan([newBlock('dsa', ['dsa:p1', 'dsa:p2', 'dsa:gone', 'dsa:p3'])]),
    )
    expect(plan.blocks.map((block) => block.items.map((planned) => planned.itemId))).toEqual([
      ['dsa:p3'],
    ])
  })

  it('paused and not-yet-started tracks are skipped', () => {
    const plan = buildResumePlan(
      planContext({
        items: NOW,
        enrollments: [
          enrollment('dsa', { status: 'paused' }),
          enrollment('english', { startDate: '2026-09-29' }),
        ],
      }),
      STALE,
    )
    expect(plan).toStrictEqual({ planDate: MONDAY, mode: 'resume', blocks: [], tracks: {} })
  })

  it('deterministic, and frozen inputs are never modified', () => {
    const ctx = Object.freeze(planContext({ items: Object.freeze(NOW) }))
    const stale = Object.freeze(STALE)
    const before = structuredClone({ ctx, stale })
    const first = buildResumePlan(ctx, stale)
    expect(buildResumePlan(ctx, stale)).toStrictEqual(first)
    expect({ ctx, stale }).toStrictEqual(before)
  })
})
