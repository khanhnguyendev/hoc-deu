import { describe, expect, it } from 'vitest'
import type { ItemState } from '../state'
import {
  CATALOG,
  enrollment,
  flat,
  itemState,
  MONDAY,
  planContext,
  planItem,
  statesOf,
} from './__tests__/fixtures'
import {
  EXTRA_MAX_ITEMS,
  EXTRA_MIN_MINUTES,
  extraBlockId,
  extraCandidates,
  offPlanMode,
  withExtraItems,
} from './extra'
import {
  MAX_BLOCK_MINUTES,
  planBlockSchema,
  type PlanBlock,
  type PlanBlockItem,
  type StoredPlan,
  type TrackSnapshot,
} from './types'

/** Deep-freezes a fixture, so a function that mutates its input fails the test. */
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const entry of Object.values(value)) deepFreeze(entry)
    Object.freeze(value)
  }
  return value
}

const SNAPSHOT: TrackSnapshot = {
  variant: '8w',
  week: 1,
  dueCount: 0,
  newPerDay: null,
  throttled: false,
  reviewDebt: false,
}

function block(
  trackId: string,
  kind: PlanBlock['kind'],
  items: readonly Pick<PlanBlockItem, 'itemId' | 'minutes'>[],
): PlanBlock {
  return {
    id: `${MONDAY}:${trackId}:${kind}:1`,
    trackId,
    kind,
    estMinutes: items.reduce((sum, item) => sum + item.minutes, 0),
    items: items.map((item) => ({ ...item, mode: 'new' })),
  }
}

function plan(
  blocks: readonly PlanBlock[],
  tracks: Record<string, TrackSnapshot> = {
    dsa: SNAPSHOT,
    english: { ...SNAPSHOT, variant: '10w', newPerDay: 8 },
  },
): StoredPlan {
  return deepFreeze({
    id: 'plan-1',
    planDate: MONDAY,
    version: 1,
    source: 'baseline',
    seenAt: null,
    blocks,
    tracks,
  })
}

const ids = (items: readonly PlanBlockItem[]) => items.map((item) => item.itemId)

describe('extraBlockId', () => {
  it('is `<date>:<track>:extra:1` (§5.4 step 8, decision 20)', () => {
    expect(extraBlockId('2026-09-28', 'dsa')).toBe('2026-09-28:dsa:extra:1')
  })
})

describe('extraCandidates ("Học thêm", decision 20)', () => {
  it("DSA: the queue's next problem not in the plan — one item, already ≥ 10 minutes", () => {
    // The queue starts lesson-arrays, p1, p2, …; today's new block holds the first two.
    const today = plan([
      block('dsa', 'new', [
        { itemId: 'dsa:lesson-arrays', minutes: 25 },
        { itemId: 'dsa:p1', minutes: 20 },
      ]),
    ])
    expect(extraCandidates(planContext(), today, 'dsa')).toEqual([
      { itemId: 'dsa:p2', mode: 'new', minutes: 35 },
    ])
  })

  it('English: cards in queue order until their minutes reach 10', () => {
    const items = extraCandidates(planContext(), plan([]), 'english')
    // 1.5 minutes each: seven cards are the first to reach 10 (10.5).
    expect(ids(items)).toEqual([
      'english:e1',
      'english:e2',
      'english:e3',
      'english:e4',
      'english:x1',
      'english:x2',
      'english:e5',
    ])
    expect(items.every((item) => item.mode === 'new' && item.minutes === 1.5)).toBe(true)
    const minutes = items.reduce((sum, item) => sum + item.minutes, 0)
    expect(minutes).toBeGreaterThanOrEqual(EXTRA_MIN_MINUTES)
    expect(minutes - 1.5).toBeLessThan(EXTRA_MIN_MINUTES)
  })

  it('skips every item already in the plan, the extra block included', () => {
    const today = plan([
      block('english', 'new', [
        { itemId: 'english:e1', minutes: 1.5 },
        { itemId: 'english:e2', minutes: 1.5 },
      ]),
      block('english', 'extra', [{ itemId: 'english:e3', minutes: 1.5 }]),
    ])
    expect(ids(extraCandidates(planContext(), today, 'english'))).toEqual([
      'english:e4',
      'english:x1',
      'english:x2',
      'english:e5',
      'english:e6',
    ])
  })

  it('never offers an introduced item (the queue has only new items)', () => {
    const ctx = planContext({
      items: statesOf(
        itemState('dsa:lesson-arrays', '2026-09-20'),
        itemState('dsa:p1', '2026-09-21'),
      ),
    })
    expect(ids(extraCandidates(ctx, plan([]), 'dsa'))).toEqual(['dsa:p2'])
  })

  it("adds nothing when the plan's snapshot throttles the track to 0 new items (§5.5)", () => {
    const throttled = plan([], {
      english: { ...SNAPSHOT, variant: '10w', dueCount: 61, newPerDay: 0, throttled: true },
    })
    expect(extraCandidates(planContext(), throttled, 'english')).toEqual([])
  })

  it('adds nothing when the queue is empty (every item introduced)', () => {
    const all = Object.values(CATALOG.items)
      .filter((item) => item.trackId === 'english')
      .map((item) => itemState(item.id, '2026-09-20'))
    const ctx = planContext({ items: statesOf(...all) })
    expect(extraCandidates(ctx, plan([]), 'english')).toEqual([])
  })

  it('adds nothing for a track that is not active, not enrolled or unknown', () => {
    const paused = planContext({
      enrollments: [enrollment('dsa', { status: 'paused' }), enrollment('english')],
    })
    expect(extraCandidates(paused, plan([]), 'dsa')).toEqual([])
    expect(extraCandidates(planContext({ enrollments: [] }), plan([]), 'dsa')).toEqual([])
    expect(extraCandidates(planContext(), plan([]), 'nope')).toEqual([])
  })

  it('follows the enrollment: bonus problems only with includeBonus (§5.3)', () => {
    const introduced: ItemState[] = [
      'dsa:lesson-arrays',
      'dsa:lesson-two-pointers',
      'dsa:p1',
      'dsa:p2',
      'dsa:p3',
      'dsa:p4',
      'dsa:p5',
      'dsa:p6',
    ].map((id) => itemState(id, '2026-09-20'))
    const ctx = planContext({ items: statesOf(...introduced) })
    expect(extraCandidates(ctx, plan([]), 'dsa')).toEqual([])
    const bonus = { ...ctx, enrollments: [enrollment('dsa', { includeBonus: true })] }
    expect(ids(extraCandidates(bonus, plan([]), 'dsa'))).toEqual(['dsa:p7'])
  })

  it('never grows the extra block past its bounds (the stored block must parse)', () => {
    const full = block('dsa', 'extra', [{ itemId: 'dsa:p9', minutes: MAX_BLOCK_MINUTES - 30 }])
    expect(extraCandidates(planContext(), plan([full]), 'dsa')).toEqual([
      { itemId: 'dsa:lesson-arrays', mode: 'new', minutes: 25 },
    ])
    const brim = block('dsa', 'extra', [{ itemId: 'dsa:p9', minutes: MAX_BLOCK_MINUTES - 10 }])
    expect(extraCandidates(planContext(), plan([brim]), 'dsa')).toEqual([])
  })

  it(`takes at most EXTRA_MAX_ITEMS (${EXTRA_MAX_ITEMS}) items, the bound of one addition`, () => {
    // 30 free cards in week 1's deck: their minutes never reach 10.
    const free = Array.from({ length: 30 }, (_, index) =>
      planItem({
        id: `english:z${index}`,
        trackId: 'english',
        itemType: 'flashcard',
        tier: 'core',
        deckId: 'english:deck-w1',
        srs: CATALOG.items['english:e1']!.srs,
        minutes: flat(0),
      }),
    )
    const deck = CATALOG.decks['english:deck-w1']!
    const catalog = {
      ...CATALOG,
      items: { ...CATALOG.items, ...Object.fromEntries(free.map((item) => [item.id, item])) },
      decks: {
        ...CATALOG.decks,
        [deck.id]: { ...deck, cardIds: free.map((item) => item.id) },
      },
    }
    const items = extraCandidates(planContext({ catalog }), plan([]), 'english')
    expect(ids(items)).toEqual(free.slice(0, EXTRA_MAX_ITEMS).map((item) => item.id))
  })

  it('never modifies its inputs', () => {
    const ctx = deepFreeze(planContext())
    expect(() => extraCandidates(ctx, plan([]), 'english')).not.toThrow()
  })
})

describe('withExtraItems', () => {
  const p2 = { itemId: 'dsa:p2', mode: 'new', minutes: 35 } as const
  const p3 = { itemId: 'dsa:p3', mode: 'new', minutes: 35 } as const

  it("creates the track's extra block, estMinutes the sum of its items", () => {
    const created = withExtraItems(plan([]), 'dsa', [p2])
    expect(created).toEqual({
      id: `${MONDAY}:dsa:extra:1`,
      trackId: 'dsa',
      kind: 'extra',
      estMinutes: 35,
      items: [p2],
    })
    expect(planBlockSchema.safeParse(created).success).toBe(true)
  })

  it('appends to the existing extra block, keeping its items (the same objects) in order', () => {
    const existing = block('dsa', 'extra', [{ itemId: 'dsa:p1', minutes: 20 }])
    const other = block('english', 'extra', [{ itemId: 'english:e1', minutes: 1.5 }])
    const grown = withExtraItems(plan([existing, other]), 'dsa', [p2, p3])
    expect(grown.id).toBe(existing.id)
    expect(grown.items).toEqual([...existing.items, p2, p3])
    expect(grown.items[0]).toEqual(existing.items[0])
    expect(grown.estMinutes).toBe(90)
  })
})

describe('offPlanMode (off-plan study, decision 21)', () => {
  const problem = CATALOG.items['dsa:p1']!
  const card = CATALOG.items['english:e1']!

  it("a result's recall / redo mode for a problem", () => {
    expect(offPlanMode(problem, undefined, 'recall')).toBe('recall')
    expect(offPlanMode(problem, itemState('dsa:p1', '2026-09-20'), 'redo')).toBe('redo')
  })

  it("'new' for an item not introduced yet", () => {
    expect(offPlanMode(problem, undefined)).toBe('new')
    expect(offPlanMode(card, undefined)).toBe('new')
  })

  it('the review mode of an introduced item (reviewMode)', () => {
    expect(offPlanMode(problem, itemState('dsa:p1', '2026-09-20'))).toBe('recall')
    expect(offPlanMode(problem, itemState('dsa:p1', '2026-09-20', { weak: true }))).toBe('redo')
    expect(offPlanMode(card, itemState('english:e1', '2026-09-20'))).toBe('review')
  })

  it('ignores a problem mode for an item without review modes', () => {
    expect(offPlanMode(card, undefined, 'recall')).toBe('new')
  })
})
