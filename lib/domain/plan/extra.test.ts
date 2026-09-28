import { describe, expect, it } from 'vitest'
import { blockKey, type BlockState, type ItemState } from '../state'
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
  extraBlockOf,
  extraCandidates,
  extraTrackIds,
  freshExtraBlockNeeded,
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

/** The track's extra block `n` (`<date>:<track>:extra:<n>`) holding `items`. */
const extraN = (
  trackId: string,
  n: number,
  items: readonly Pick<PlanBlockItem, 'itemId' | 'minutes'>[],
): PlanBlock => ({ ...block(trackId, 'extra', items), id: `${MONDAY}:${trackId}:extra:${n}` })

describe('extraBlockId', () => {
  it('is `<date>:<track>:extra:1` (§5.4 step 8, decision 20)', () => {
    expect(extraBlockId('2026-09-28', 'dsa')).toBe('2026-09-28:dsa:extra:1')
  })

  it('numbers a fresh extra block: `<date>:<track>:extra:<n>` (ruling M5-R36, M-3)', () => {
    expect(extraBlockId('2026-09-28', 'english', 2)).toBe('2026-09-28:english:extra:2')
  })
})

describe('extraBlockOf (the track’s latest extra block)', () => {
  const first = extraN('english', 1, [{ itemId: 'english:e1', minutes: 1.5 }])
  const second = extraN('english', 2, [{ itemId: 'english:e2', minutes: 1.5 }])

  it('is extra:1, else none', () => {
    expect(extraBlockOf(plan([first]), 'english')).toEqual(first)
    expect(extraBlockOf(plan([first]), 'dsa')).toBeUndefined()
    expect(extraBlockOf(plan([]), 'english')).toBeUndefined()
  })

  it('is the last of extra:1, extra:2, … in number order', () => {
    expect(extraBlockOf(plan([first, second]), 'english')).toEqual(second)
    expect(extraBlockOf(plan([second, first]), 'english')).toEqual(second)
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

  it('adds nothing for a track that has not started, or whose catalog track is not active', () => {
    const later = planContext({
      enrollments: [enrollment('dsa', { startDate: '2026-10-01' }), enrollment('english')],
    })
    expect(extraCandidates(later, plan([]), 'dsa')).toEqual([])
    const retired = planContext({
      catalog: {
        ...CATALOG,
        tracks: { ...CATALOG.tracks, dsa: { ...CATALOG.tracks.dsa!, status: 'retired' } },
      },
    })
    expect(extraCandidates(retired, plan([]), 'dsa')).toEqual([])
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

  describe('with roadmap overrides (§5.12; task 6.6c)', () => {
    const reorder = {
      trackId: 'dsa',
      key: 'tp-first',
      kind: 'reorder_topics' as const,
      params: { order: ['two-pointers', 'arrays'] },
      startLocalDay: MONDAY,
    }
    const extraWeek = (usedDays: number) => ({
      trackId: 'dsa',
      key: 'arrays-extra',
      kind: 'extra_week' as const,
      params: { topicId: 'arrays', studyDays: 5 },
      startLocalDay: MONDAY,
      usedDays,
    })

    it('reads the effective roadmap (an active reorder)', () => {
      const ctx = planContext({ overrides: [reorder] })
      expect(ids(extraCandidates(ctx, plan([]), 'dsa'))).toEqual(['dsa:lesson-two-pointers'])
      expect(ids(extraCandidates(planContext(), plan([]), 'dsa'))).toEqual(['dsa:lesson-arrays'])
    })

    it('adds no new item while the track is in an extra week (the plan names it)', () => {
      const today = plan([], { dsa: { ...SNAPSHOT, extraWeek: 'arrays-extra' } })
      expect(extraCandidates(planContext(), today, 'dsa')).toEqual([])
    })

    it('adds no new item while an extra week of the track is active, but again once it is used up', () => {
      expect(extraCandidates(planContext({ overrides: [extraWeek(2)] }), plan([]), 'dsa')).toEqual(
        [],
      )
      expect(
        ids(extraCandidates(planContext({ overrides: [extraWeek(5)] }), plan([]), 'dsa')),
      ).toEqual(['dsa:lesson-arrays'])
      // Another track's extra week does not stop English.
      expect(
        extraCandidates(planContext({ overrides: [extraWeek(0)] }), plan([]), 'english').length,
      ).toBeGreaterThan(0)
    })
  })

  it('never modifies its inputs', () => {
    const ctx = deepFreeze(planContext())
    expect(() => extraCandidates(ctx, plan([]), 'english')).not.toThrow()
  })
})

describe('extraTrackIds (the engine’s eligibility, M5-R33 M-4)', () => {
  it('the active, started enrollments of active catalog tracks, in trackId order', () => {
    const ctx = planContext({ enrollments: [enrollment('english'), enrollment('dsa')] })
    expect(extraTrackIds(ctx)).toEqual(['dsa', 'english'])
  })

  it('leaves out paused, removed and not-started enrollments, and retired catalog tracks', () => {
    expect(
      extraTrackIds(
        planContext({
          enrollments: [
            enrollment('dsa', { status: 'paused' }),
            enrollment('english', { startDate: '2026-10-01' }),
          ],
        }),
      ),
    ).toEqual([])
    const retired = planContext({
      catalog: {
        ...CATALOG,
        tracks: { ...CATALOG.tracks, english: { ...CATALOG.tracks.english!, status: 'retired' } },
      },
    })
    expect(extraTrackIds(retired)).toEqual(['dsa'])
  })

  it('agrees with extraCandidates: a track it leaves out gets no candidates', () => {
    const ctx = planContext({ enrollments: [enrollment('dsa', { startDate: '2026-10-05' })] })
    expect(extraTrackIds(ctx)).toEqual([])
    expect(extraCandidates(ctx, plan([]), 'dsa')).toEqual([])
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

  describe('a fresh extra block (ruling M5-R36, M-3)', () => {
    const e2 = { itemId: 'english:e2', mode: 'review', minutes: 1.5 } as const
    const first = extraN('english', 1, [{ itemId: 'english:e1', minutes: 1.5 }])

    it('is extra:1 when the track has none', () => {
      expect(withExtraItems(plan([]), 'english', [e2], { fresh: true })).toEqual({
        id: `${MONDAY}:english:extra:1`,
        trackId: 'english',
        kind: 'extra',
        estMinutes: 1.5,
        items: [e2],
      })
    })

    it('is the next number after the latest one, holding only the new items', () => {
      const fresh = withExtraItems(plan([first]), 'english', [e2], { fresh: true })
      expect(fresh).toEqual({
        id: `${MONDAY}:english:extra:2`,
        trackId: 'english',
        kind: 'extra',
        estMinutes: 1.5,
        items: [e2],
      })
      expect(planBlockSchema.safeParse(fresh).success).toBe(true)
    })

    it('the next addition appends to the latest extra block, the fresh one', () => {
      const second = extraN('english', 2, [{ itemId: 'english:e2', minutes: 1.5 }])
      const e3 = { itemId: 'english:e3', mode: 'new', minutes: 1.5 } as const
      const grown = withExtraItems(plan([first, second]), 'english', [e3])
      expect(grown.id).toBe(second.id)
      expect(ids(grown.items)).toEqual(['english:e2', 'english:e3'])
    })

    it('extraCandidates measures the room of the latest extra block', () => {
      const full = extraN('dsa', 1, [{ itemId: 'dsa:p9', minutes: MAX_BLOCK_MINUTES }])
      const small = extraN('dsa', 2, [{ itemId: 'dsa:p8', minutes: 5 }])
      expect(extraCandidates(planContext(), plan([full]), 'dsa')).toEqual([])
      expect(ids(extraCandidates(planContext(), plan([full, small]), 'dsa'))).toEqual([
        'dsa:lesson-arrays',
      ])
    })
  })
})

describe('freshExtraBlockNeeded (off-plan study of a track the paused view hides, M-3)', () => {
  const extra = extraN('english', 1, [
    { itemId: 'english:e1', minutes: 1.5 },
    { itemId: 'english:e2', minutes: 1.5 },
  ])
  const target = plan([extra])
  const studied = (itemId: string): ItemState => itemState(itemId, MONDAY)
  const handledBoth = statesOf(studied('english:e1'), studied('english:e2'))
  const checkIn = (change: Partial<BlockState>): Record<string, BlockState> => ({
    [blockKey(target.id, extra.id)]: {
      planId: target.id,
      blockId: extra.id,
      trackId: 'english',
      status: 'skipped',
      minutes: 0,
      note: null,
      auto: false,
      checkedInOn: MONDAY,
      ...change,
    },
  })

  it('is false without an extra block of the track: the attachment creates one', () => {
    expect(freshExtraBlockNeeded(target, 'dsa', {}, {})).toBe(false)
  })

  it('is false while every item of the extra block is handled: its auto check-in follows', () => {
    expect(freshExtraBlockNeeded(target, 'english', {}, handledBoth)).toBe(false)
    const skipped = statesOf(
      studied('english:e1'),
      itemState('english:e2', MONDAY, { status: 'skipped', lastResultOn: null }),
    )
    expect(freshExtraBlockNeeded(target, 'english', {}, skipped)).toBe(false)
    const auto = checkIn({ status: 'done', minutes: 3, auto: true })
    expect(freshExtraBlockNeeded(target, 'english', auto, handledBoth)).toBe(false)
  })

  it('is true when the extra block holds an item not studied on or after the plan date', () => {
    expect(freshExtraBlockNeeded(target, 'english', {}, statesOf(studied('english:e1')))).toBe(true)
    const older = statesOf(studied('english:e1'), itemState('english:e2', '2026-09-20'))
    expect(freshExtraBlockNeeded(target, 'english', {}, older)).toBe(true)
  })

  it('is true when the learner checked it in (a skip): the auto check-in never replaces that', () => {
    expect(freshExtraBlockNeeded(target, 'english', checkIn({}), handledBoth)).toBe(true)
  })

  it('reads the latest extra block, and never modifies its inputs', () => {
    const second = extraN('english', 2, [{ itemId: 'english:e3', minutes: 1.5 }])
    const both = plan([extra, second])
    const states = deepFreeze(statesOf(studied('english:e3')))
    expect(freshExtraBlockNeeded(both, 'english', deepFreeze({}), states)).toBe(false)
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
