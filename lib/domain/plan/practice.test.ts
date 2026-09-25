import { describe, expect, it } from 'vitest'
import { CATALOG, itemState, statesOf, withItems } from './__tests__/fixtures'
import {
  GRADE_RANK,
  mockInterviewProblem,
  pickByItemType,
  pickByTag,
  pickShadowing,
  SHADOWING_TAG,
} from './practice'

const DAY = '2026-09-29'

describe('practice constants', () => {
  it('SHADOWING_TAG is "shadowing"', () => {
    expect(SHADOWING_TAG).toBe('shadowing')
  })

  it('GRADE_RANK ranks miss before close before pass', () => {
    expect(GRADE_RANK).toEqual({ miss: 0, close: 1, pass: 2 })
  })
})

describe('pickByItemType (platform design §5.6 exercise rule)', () => {
  it('week 1, nothing introduced → the first not-introduced exercise of that week', () => {
    expect(
      pickByItemType({
        trackId: 'english',
        itemType: 'exercise',
        roadmapWeek: 1,
        items: {},
        catalog: CATALOG,
      }),
    ).toBe('english:ex-w1-a')
  })

  it('the first exercise introduced → the next not-introduced one of the same week', () => {
    const items = statesOf(itemState('english:ex-w1-a', DAY))
    expect(
      pickByItemType({
        trackId: 'english',
        itemType: 'exercise',
        roadmapWeek: 1,
        items,
        catalog: CATALOG,
      }),
    ).toBe('english:ex-w1-b')
  })

  it('both introduced → the one with the worst last grade (miss beats close beats pass)', () => {
    const items = statesOf(
      itemState('english:ex-w1-a', DAY, { lastResult: 'close', lastResultOn: '2026-09-20' }),
      itemState('english:ex-w1-b', DAY, { lastResult: 'miss', lastResultOn: '2026-09-25' }),
    )
    expect(
      pickByItemType({
        trackId: 'english',
        itemType: 'exercise',
        roadmapWeek: 1,
        items,
        catalog: CATALOG,
      }),
    ).toBe('english:ex-w1-b')
  })

  it('same grade → the older lastResultOn wins', () => {
    const items = statesOf(
      itemState('english:ex-w1-a', DAY, { lastResult: 'close', lastResultOn: '2026-09-20' }),
      itemState('english:ex-w1-b', DAY, { lastResult: 'close', lastResultOn: '2026-09-15' }),
    )
    expect(
      pickByItemType({
        trackId: 'english',
        itemType: 'exercise',
        roadmapWeek: 1,
        items,
        catalog: CATALOG,
      }),
    ).toBe('english:ex-w1-b')
  })

  it('a week with no exercises and none introduced → null [RF-4]', () => {
    expect(
      pickByItemType({
        trackId: 'english',
        itemType: 'exercise',
        roadmapWeek: 3,
        items: {},
        catalog: CATALOG,
      }),
    ).toBeNull()
  })

  // Final review M-12: skipped out of review (status skipped), as dueQueue excludes it.
  it('the introduced fallback never picks a skipped exercise', () => {
    const items = statesOf(
      itemState('english:ex-w1-a', DAY, { lastResult: 'miss', status: 'skipped' }),
      itemState('english:ex-w1-b', DAY, { lastResult: 'pass' }),
    )
    expect(
      pickByItemType({
        trackId: 'english',
        itemType: 'exercise',
        roadmapWeek: 1,
        items,
        catalog: CATALOG,
      }),
    ).toBe('english:ex-w1-b')
    expect(
      pickByItemType({
        trackId: 'english',
        itemType: 'exercise',
        roadmapWeek: 1,
        items: statesOf(
          itemState('english:ex-w1-a', DAY, { status: 'skipped' }),
          itemState('english:ex-w1-b', DAY, { status: 'skipped' }),
        ),
        catalog: CATALOG,
      }),
    ).toBeNull()
  })

  it('a draft exercise is never picked', () => {
    const draftCatalog = withItems(CATALOG, { 'english:ex-w1-a': { status: 'draft' } })
    expect(
      pickByItemType({
        trackId: 'english',
        itemType: 'exercise',
        roadmapWeek: 1,
        items: {},
        catalog: draftCatalog,
      }),
    ).toBe('english:ex-w1-b')
  })
})

describe('pickByTag (platform design §5.6)', () => {
  it('DSA mock-interview → the repeatable prompt, whatever the week', () => {
    expect(
      pickByTag({
        trackId: 'dsa',
        tag: 'mock-interview',
        roadmapWeek: 1,
        items: {},
        catalog: CATALOG,
      }),
    ).toBe('dsa:prompt-mock')
    expect(
      pickByTag({
        trackId: 'dsa',
        tag: 'mock-interview',
        roadmapWeek: 5,
        items: {},
        catalog: CATALOG,
      }),
    ).toBe('dsa:prompt-mock')
  })

  it('English weekend-task week 2 → the week-2 prompt', () => {
    expect(
      pickByTag({
        trackId: 'english',
        tag: 'weekend-task',
        roadmapWeek: 2,
        items: {},
        catalog: CATALOG,
      }),
    ).toBe('english:prompt-w2')
  })

  it('week 2 with w2 introduced and w1 not → the earlier not-introduced one (catch-up)', () => {
    const items = statesOf(itemState('english:prompt-w2', DAY))
    expect(
      pickByTag({
        trackId: 'english',
        tag: 'weekend-task',
        roadmapWeek: 2,
        items,
        catalog: CATALOG,
      }),
    ).toBe('english:prompt-w1')
  })

  it('week 3 with both introduced → null', () => {
    const items = statesOf(itemState('english:prompt-w1', DAY), itemState('english:prompt-w2', DAY))
    expect(
      pickByTag({
        trackId: 'english',
        tag: 'weekend-task',
        roadmapWeek: 3,
        items,
        catalog: CATALOG,
      }),
    ).toBeNull()
  })

  it('an unknown tag → null', () => {
    expect(
      pickByTag({
        trackId: 'english',
        tag: 'does-not-exist',
        roadmapWeek: 1,
        items: {},
        catalog: CATALOG,
      }),
    ).toBeNull()
  })
})

describe('pickShadowing (platform design §5.6)', () => {
  it("today's new cards with an example, in plan order, max 3", () => {
    expect(
      pickShadowing({
        trackId: 'english',
        todaysNew: ['english:e3', 'english:e1', 'english:e2', 'english:e4'],
        items: {},
        catalog: CATALOG,
      }),
    ).toEqual(['english:e1', 'english:e2'])
  })

  it('caps at 3 even when more than 3 of the new cards have an example', () => {
    expect(
      pickShadowing({
        trackId: 'english',
        todaysNew: ['english:e1', 'english:e2', 'english:x1', 'english:e5'],
        items: {},
        catalog: CATALOG,
      }),
    ).toEqual(['english:e1', 'english:e2', 'english:x1'])
  })

  it('no new cards → the most recently introduced cards with an example, introducedOn desc then ID', () => {
    const items = statesOf(
      itemState('english:x1', '2026-09-29'),
      itemState('english:e1', '2026-09-30'),
    )
    expect(pickShadowing({ trackId: 'english', todaysNew: [], items, catalog: CATALOG })).toEqual([
      'english:e1',
      'english:x1',
    ])
  })

  it('nothing available → empty', () => {
    expect(
      pickShadowing({ trackId: 'english', todaysNew: [], items: {}, catalog: CATALOG }),
    ).toEqual([])
  })

  it('a retired card with an example is excluded from todaysNew', () => {
    const retiredCatalog = withItems(CATALOG, { 'english:e1': { status: 'retired' } })
    expect(
      pickShadowing({
        trackId: 'english',
        todaysNew: ['english:e1'],
        items: {},
        catalog: retiredCatalog,
      }),
    ).toEqual([])
  })

  it('a card skipped out of review is excluded from the introduced fallback (M-12)', () => {
    const items = statesOf(
      itemState('english:e1', '2026-09-30', { status: 'skipped', dueOn: null }),
      itemState('english:x1', '2026-09-29'),
    )
    expect(pickShadowing({ trackId: 'english', todaysNew: [], items, catalog: CATALOG })).toEqual([
      'english:x1',
    ])
  })

  it('a retired card with an example is excluded from the introduced fallback', () => {
    const retiredCatalog = withItems(CATALOG, { 'english:e1': { status: 'retired' } })
    const items = statesOf(
      itemState('english:e1', '2026-09-30', {}, retiredCatalog),
      itemState('english:x1', '2026-09-29', {}, retiredCatalog),
    )
    expect(
      pickShadowing({ trackId: 'english', todaysNew: [], items, catalog: retiredCatalog }),
    ).toEqual(['english:x1'])
  })
})

describe('mockInterviewProblem (platform design §5.6)', () => {
  it('the introduced active Medium problem with the oldest lastResultOn', () => {
    const items = statesOf(
      itemState('dsa:p1', DAY, { lastResultOn: '2026-09-28' }), // Easy — excluded
      itemState('dsa:p2', DAY, { lastResultOn: '2026-09-30' }),
      itemState('dsa:p3', DAY, { lastResultOn: '2026-09-29' }),
    )
    expect(mockInterviewProblem({ trackId: 'dsa', items, catalog: CATALOG })).toBe('dsa:p3')
  })

  it('none introduced → null', () => {
    expect(mockInterviewProblem({ trackId: 'dsa', items: {}, catalog: CATALOG })).toBeNull()
  })

  it('a retired Medium problem is never picked', () => {
    const items = statesOf(itemState('dsa:p8', DAY, { lastResultOn: '2026-09-01' }))
    expect(mockInterviewProblem({ trackId: 'dsa', items, catalog: CATALOG })).toBeNull()
  })

  it('a level-0 (not truly introduced) Medium problem is never picked', () => {
    const items = statesOf(itemState('dsa:p2', DAY, { level: 0, lastResultOn: '2026-09-01' }))
    expect(mockInterviewProblem({ trackId: 'dsa', items, catalog: CATALOG })).toBeNull()
  })

  it('a Medium problem skipped out of review is never picked (M-12)', () => {
    const items = statesOf(
      itemState('dsa:p2', DAY, {
        level: 2,
        status: 'skipped',
        dueOn: null,
        lastResultOn: '2026-09-01',
      }),
      itemState('dsa:p3', DAY, { lastResultOn: '2026-09-29' }),
    )
    expect(mockInterviewProblem({ trackId: 'dsa', items, catalog: CATALOG })).toBe('dsa:p3')
  })

  it('a missing lastResultOn sorts last', () => {
    const items = statesOf(
      itemState('dsa:p2', DAY, { lastResultOn: null }),
      itemState('dsa:p3', DAY, { lastResultOn: '2026-09-29' }),
    )
    expect(mockInterviewProblem({ trackId: 'dsa', items, catalog: CATALOG })).toBe('dsa:p3')
  })
})
