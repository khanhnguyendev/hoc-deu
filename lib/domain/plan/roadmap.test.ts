import { describe, expect, it } from 'vitest'
import type { PlanRoadmap, PlanRoadmapWeek } from '../catalog'
import type { ItemState } from '../state'
import { CATALOG, DSA_8W, ENGLISH_10W, itemState, statesOf, withItems } from './__tests__/fixtures'
import {
  coreItemsOfWeek,
  isPassed,
  newQueue,
  recapCandidates,
  recapSource,
  roadmapWeek,
  weekForProgress,
  weekSizes,
} from './roadmap'

/** Freezes `value` and everything it reaches, so a function that mutates its input throws. */
function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value)) deepFreeze(child)
  }
  return value
}

// CATALOG reaches DSA_8W and ENGLISH_10W through its tracks.
deepFreeze(CATALOG)

const DAY = '2026-09-28'

/** States for items introduced on `DAY` at level 1 (level 0 for completion-only items). */
const introduced = (...ids: readonly string[]): Record<string, ItemState> =>
  deepFreeze(statesOf(...ids.map((id) => itemState(id, DAY))))

const frozen = (...states: readonly ItemState[]): Record<string, ItemState> =>
  deepFreeze(statesOf(...states))

function weekOf(roadmap: PlanRoadmap, week: number): PlanRoadmapWeek {
  const found = roadmap.weeks.find((candidate) => candidate.week === week)
  if (found === undefined) throw new Error(`no week ${week} in ${roadmap.id}`)
  return found
}

const derived = (source: string): string => `english:explaining-code:${source}`

describe('coreItemsOfWeek', () => {
  it("lists a week's core problems whatever their status (the retired p8 included)", () => {
    expect(coreItemsOfWeek(weekOf(DSA_8W, 2), CATALOG)).toEqual(['dsa:p5', 'dsa:p6', 'dsa:p8'])
  })

  it("lists the core-tier cards of a week's decks, without the extended cards", () => {
    expect(coreItemsOfWeek(weekOf(ENGLISH_10W, 1), CATALOG)).toEqual([
      'english:e1',
      'english:e2',
      'english:e3',
      'english:e4',
    ])
  })
})

describe('weekSizes', () => {
  it('counts the core items per week', () => {
    expect(weekSizes(DSA_8W, CATALOG)).toEqual([3, 3])
    expect(weekSizes(ENGLISH_10W, CATALOG)).toEqual([4, 2])
  })
})

describe('isPassed', () => {
  it('passes an introduced item and an item that is not active (decision 16)', () => {
    const catalog = withItems(CATALOG, { 'dsa:p6': { status: 'draft' } })
    const items = introduced('dsa:p1')
    expect(isPassed('dsa:p1', catalog, items)).toBe(true)
    expect(isPassed('dsa:p8', catalog, items)).toBe(true) // retired
    expect(isPassed('dsa:p6', catalog, items)).toBe(true) // draft
    expect(isPassed('dsa:missing', catalog, items)).toBe(true)
    expect(isPassed('dsa:p5', catalog, items)).toBe(false)
  })
})

describe('weekForProgress', () => {
  it.each([
    [0, 1],
    [7, 1],
    [8, 2],
    [20, 3],
    [99, 3],
  ])('[8, 8, 7]: %i passed core items → week %i', (passedCore, expected) => {
    expect(weekForProgress(passedCore, [8, 8, 7])).toBe(expected)
  })

  it('is week 1 without week sizes', () => {
    expect(weekForProgress(0, [])).toBe(1)
    expect(weekForProgress(5, [])).toBe(1)
  })
})

describe('roadmapWeek', () => {
  it('is week 1 when nothing is introduced', () => {
    expect(roadmapWeek(DSA_8W, CATALOG, {})).toBe(1)
  })

  it('moves to week 2 once week 1’s core items are introduced', () => {
    expect(roadmapWeek(DSA_8W, CATALOG, introduced('dsa:p1', 'dsa:p2', 'dsa:p3'))).toBe(2)
  })

  it('counts the retired p8 as passed and clamps to the last week', () => {
    const items = introduced('dsa:p1', 'dsa:p2', 'dsa:p3', 'dsa:p5', 'dsa:p6')
    expect(roadmapWeek(DSA_8W, CATALOG, items)).toBe(2)
  })

  it('is week 1 without a roadmap', () => {
    expect(roadmapWeek(null, CATALOG, introduced('dsa:p1', 'dsa:p2', 'dsa:p3'))).toBe(1)
  })
})

describe('newQueue', () => {
  const dsaQueue = (
    items: Readonly<Record<string, ItemState>>,
    change: { includeBonus?: boolean; catalog?: typeof CATALOG } = {},
  ) =>
    newQueue({
      trackId: 'dsa',
      roadmap: DSA_8W,
      catalog: change.catalog ?? CATALOG,
      items,
      includeBonus: change.includeBonus ?? false,
    })

  const englishQueue = (
    items: Readonly<Record<string, ItemState>>,
    roadmap: PlanRoadmap | null = ENGLISH_10W,
  ) => newQueue({ trackId: 'english', roadmap, catalog: CATALOG, items, includeBonus: false })

  const DSA_NOTHING_INTRODUCED = [
    'dsa:lesson-arrays',
    'dsa:p1',
    'dsa:p2',
    'dsa:p3',
    'dsa:p4',
    'dsa:lesson-two-pointers',
    'dsa:p5',
    'dsa:p6',
  ]

  it('DSA: pattern lesson, core, recap items without a mode — no deep-dive, retired or bonus item', () => {
    expect(dsaQueue({})).toEqual(DSA_NOTHING_INTRODUCED)
  })

  it('DSA: bonus problems follow the core items with includeBonus', () => {
    expect(dsaQueue({}, { includeBonus: true })).toEqual([...DSA_NOTHING_INTRODUCED, 'dsa:p7'])
  })

  it('DSA: drops introduced items', () => {
    expect(dsaQueue(introduced('dsa:p1'))).toEqual(
      DSA_NOTHING_INTRODUCED.filter((id) => id !== 'dsa:p1'),
    )
  })

  it('DSA: drops a draft pattern lesson', () => {
    const catalog = withItems(CATALOG, { 'dsa:lesson-arrays': { status: 'draft' } })
    expect(dsaQueue({}, { catalog })).toEqual(
      DSA_NOTHING_INTRODUCED.filter((id) => id !== 'dsa:lesson-arrays'),
    )
  })

  it('English: core cards, extended cards, week by week', () => {
    expect(englishQueue({})).toEqual([
      'english:e1',
      'english:e2',
      'english:e3',
      'english:e4',
      'english:x1',
      'english:x2',
      'english:e5',
      'english:e6',
    ])
  })

  // p2 unlocks first (introduced 2026-09-29), p1 second (2026-09-30).
  const unlocked = [itemState('dsa:p2', '2026-09-29'), itemState('dsa:p1', '2026-09-30')] as const

  it('English: unlocked derived cards follow the first open week’s core cards, in unlock order', () => {
    expect(englishQueue(frozen(...unlocked))).toEqual([
      'english:e1',
      'english:e2',
      'english:e3',
      'english:e4',
      derived('dsa:p2'),
      derived('dsa:p1'),
      'english:x1',
      'english:x2',
      'english:e5',
      'english:e6',
    ])
  })

  it('English: the unlock order stays when a source gets a later result (decision 15)', () => {
    const [p2, p1] = unlocked
    const items = frozen({ ...p2, lastResultOn: '2026-10-02' }, p1)
    expect(englishQueue(items).slice(4, 6)).toEqual([derived('dsa:p2'), derived('dsa:p1')])
  })

  it('English: derived cards move to the next week that still has new cards', () => {
    const week1 = ['e1', 'e2', 'e3', 'e4', 'x1', 'x2'].map((card) =>
      itemState(`english:${card}`, DAY),
    )
    expect(englishQueue(frozen(...unlocked, ...week1))).toEqual([
      'english:e5',
      'english:e6',
      derived('dsa:p2'),
      derived('dsa:p1'),
    ])
  })

  it('English: derived cards are the whole queue once every roadmap card is introduced', () => {
    const cards = ['e1', 'e2', 'e3', 'e4', 'x1', 'x2', 'e5', 'e6'].map((card) =>
      itemState(`english:${card}`, DAY),
    )
    expect(englishQueue(frozen(...unlocked, ...cards))).toEqual([
      derived('dsa:p2'),
      derived('dsa:p1'),
    ])
    const withDerived = [...cards, itemState(derived('dsa:p2'), DAY)]
    expect(englishQueue(frozen(...unlocked, ...withDerived))).toEqual([derived('dsa:p1')])
  })

  it('English: a derived card stays locked while its source was only skipped', () => {
    const [p2] = unlocked
    const skipped = itemState('dsa:p1', DAY, {
      level: 0,
      status: 'skipped',
      lastResult: null,
      lastResultOn: null,
    })
    expect(englishQueue(frozen(p2, skipped))).not.toContain(derived('dsa:p1'))
    expect(englishQueue(frozen(p2, skipped))).toContain(derived('dsa:p2'))
  })

  it('English: without a roadmap only the derived cards remain', () => {
    expect(englishQueue(frozen(...unlocked), null)).toEqual([derived('dsa:p2'), derived('dsa:p1')])
  })
})

describe('recapSource', () => {
  const source = (
    items: Readonly<Record<string, ItemState>>,
    done: ReadonlySet<number>,
    currentWeek: number,
  ) => recapSource({ roadmap: DSA_8W, catalog: CATALOG, items, done, currentWeek })

  it('is the latest week whose core items are all passed', () => {
    const items = introduced('dsa:p1', 'dsa:p2', 'dsa:p3')
    const currentWeek = roadmapWeek(DSA_8W, CATALOG, items)
    expect(currentWeek).toBe(2)
    expect(source(items, new Set(), currentWeek)).toBe(1)
  })

  it('skips a week whose recap is done', () => {
    expect(source(introduced('dsa:p1', 'dsa:p2', 'dsa:p3'), new Set([1]), 2)).toBeNull()
  })

  it('is null while a core item of the week is not passed', () => {
    expect(source(introduced('dsa:p1', 'dsa:p2'), new Set(), 1)).toBeNull()
  })

  it('is null without a roadmap', () => {
    const items = introduced('dsa:p1', 'dsa:p2', 'dsa:p3')
    expect(
      recapSource({ roadmap: null, catalog: CATALOG, items, done: new Set(), currentWeek: 2 }),
    ).toBeNull()
  })
})

describe('recapCandidates', () => {
  const candidates = (
    items: Readonly<Record<string, ItemState>>,
    change: { week?: number | null; count?: number; exclude?: ReadonlySet<string> } = {},
  ) =>
    recapCandidates({
      trackId: 'dsa',
      roadmap: DSA_8W,
      week: change.week === undefined ? 1 : change.week,
      catalog: CATALOG,
      items,
      count: change.count ?? 3,
      exclude: change.exclude ?? new Set(),
    })

  it("takes the week's recap entries with a mode, in file order, when introduced", () => {
    expect(candidates(introduced('dsa:p1', 'dsa:p2'))).toEqual([
      { itemId: 'dsa:p2', mode: 'redo' },
      { itemId: 'dsa:p1', mode: 'explain-aloud' },
    ])
  })

  it('stops at count', () => {
    expect(candidates(introduced('dsa:p1', 'dsa:p2'), { count: 1 })).toEqual([
      { itemId: 'dsa:p2', mode: 'redo' },
    ])
  })

  it('fills up to count with other introduced items in their review mode, never p4', () => {
    expect(candidates(introduced('dsa:p1', 'dsa:p2', 'dsa:p3'))).toEqual([
      { itemId: 'dsa:p2', mode: 'redo' },
      { itemId: 'dsa:p1', mode: 'explain-aloud' },
      { itemId: 'dsa:p3', mode: 'recall' },
    ])
  })

  it('never picks an excluded item', () => {
    const items = introduced('dsa:p1', 'dsa:p2', 'dsa:p3')
    expect(candidates(items, { exclude: new Set(['dsa:p3']) })).toEqual([
      { itemId: 'dsa:p2', mode: 'redo' },
      { itemId: 'dsa:p1', mode: 'explain-aloud' },
    ])
    expect(candidates(items, { exclude: new Set(['dsa:p2']) })).toEqual([
      { itemId: 'dsa:p1', mode: 'explain-aloud' },
      { itemId: 'dsa:p3', mode: 'recall' },
    ])
  })

  it('spreads filler across topics', () => {
    // a1 = p1 and a2 = p2 (arrays, level 1), t1 = p5 (two-pointers, level 2).
    const items = frozen(
      itemState('dsa:p1', DAY),
      itemState('dsa:p2', DAY),
      itemState('dsa:p5', DAY, { level: 2 }),
    )
    expect(candidates(items, { week: null, count: 2 })).toEqual([
      { itemId: 'dsa:p1', mode: 'recall' },
      { itemId: 'dsa:p5', mode: 'recall' },
    ])
  })

  it('orders filler by level, then the oldest last result', () => {
    const items = frozen(
      itemState('dsa:p1', DAY, { level: 2 }),
      itemState('dsa:p2', DAY, { lastResultOn: '2026-10-01' }),
      itemState('dsa:p3', DAY, { lastResultOn: '2026-09-30' }),
    )
    expect(candidates(items, { week: null, count: 3 }).map((pick) => pick.itemId)).toEqual([
      'dsa:p3',
      'dsa:p2',
      'dsa:p1',
    ])
  })

  it('reviews a Weak filler problem by redo', () => {
    const items = frozen(itemState('dsa:p3', DAY, { weak: true, status: 'weak' }))
    expect(candidates(items, { week: null })).toEqual([{ itemId: 'dsa:p3', mode: 'redo' }])
  })

  it('never fills with mastered, retired or other-track items', () => {
    const items = frozen(
      itemState('dsa:p5', DAY, { level: 3, status: 'mastered' }),
      itemState('dsa:p8', DAY),
      itemState('english:e1', DAY),
    )
    expect(candidates(items, { week: null })).toEqual([])
  })

  it('is empty with week null and nothing introduced', () => {
    expect(candidates({}, { week: null })).toEqual([])
  })
})
