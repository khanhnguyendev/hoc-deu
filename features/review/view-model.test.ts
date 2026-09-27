import { describe, expect, it } from 'vitest'
import {
  CATALOG,
  enrollment,
  itemState,
  statesOf,
  withItems,
} from '@/lib/domain/plan/__tests__/fixtures'
import { reviewQueue } from './view-model'

const TODAY = '2026-10-10'
const BOTH = [enrollment('dsa'), enrollment('english')]

describe('reviewQueue (platform design §2.4, §5.4 step 3, RF-4; Part B-M5 task 5.3)', () => {
  it('sorts Weak first across tracks, before a non-Weak item far more overdue', () => {
    const items = statesOf(
      itemState('english:e1', '2026-10-01', { weak: true, status: 'weak', dueOn: TODAY }),
      itemState('dsa:p1', '2026-10-01', { dueOn: '2026-09-20' }),
    )
    const result = reviewQueue({ catalog: CATALOG, enrollments: BOTH, items, today: TODAY })
    expect(result.map((entry) => entry.itemId)).toEqual(['english:e1', 'dsa:p1'])
  })

  it('sorts a weak-topic item next, even less overdue than a non-weak-topic item (discriminating: deleting the weak-topic step flips this order)', () => {
    const items = statesOf(
      // p1 and p2 Weak make "arrays" a weak topic; p4 (topic "arrays", not itself Weak, due
      // today — 0 days overdue) must still sort before p5 (topic "two-pointers", 2 days
      // overdue) — the overdue tie-break alone would put p5 first.
      itemState('dsa:p1', '2026-10-01', { weak: true, status: 'weak', dueOn: TODAY }),
      itemState('dsa:p2', '2026-10-01', { weak: true, status: 'weak', dueOn: TODAY }),
      itemState('dsa:p4', '2026-10-01', { dueOn: TODAY }),
      itemState('dsa:p5', '2026-10-01', { dueOn: '2026-10-08' }),
    )
    const result = reviewQueue({ catalog: CATALOG, enrollments: BOTH, items, today: TODAY })
    expect(result.map((entry) => entry.itemId)).toEqual(['dsa:p1', 'dsa:p2', 'dsa:p4', 'dsa:p5'])
  })

  it('a weak topic in one track never promotes a same-named topic in another track (review round 1, I1)', () => {
    // english:e2 shares the literal topic id "arrays" with dsa's weak topic, but only one english
    // item carries it (WEAK_TOPIC_MIN is 2), so it is not a weak topic within english itself.
    const catalog = withItems(CATALOG, { 'english:e2': { topicId: 'arrays' } })
    const items = statesOf(
      itemState('dsa:p1', '2026-10-01', { weak: true, status: 'weak', dueOn: TODAY }, catalog),
      itemState('dsa:p2', '2026-10-01', { weak: true, status: 'weak', dueOn: TODAY }, catalog),
      itemState('english:e1', '2026-10-01', { dueOn: '2026-10-05' }, catalog),
      itemState('english:e2', '2026-10-01', { dueOn: TODAY }, catalog),
    )
    const result = reviewQueue({
      catalog,
      enrollments: BOTH,
      items,
      today: TODAY,
      track: 'english',
    })
    // Neither gets a weak-topic boost within English: the more overdue e1 sorts first.
    expect(result.map((entry) => entry.itemId)).toEqual(['english:e1', 'english:e2'])
  })

  it('excludes items of a paused or removed track', () => {
    const items = statesOf(
      itemState('dsa:p1', '2026-10-01', { dueOn: TODAY }),
      itemState('english:e1', '2026-10-01', { dueOn: TODAY }),
    )
    const enrollments = [
      enrollment('dsa', { status: 'paused' }),
      enrollment('english', { status: 'removed' }),
    ]
    expect(reviewQueue({ catalog: CATALOG, enrollments, items, today: TODAY })).toEqual([])
  })

  it("excludes a track whose enrollment has not started yet (M7: the engine's eligibility, not merely status)", () => {
    const items = statesOf(itemState('dsa:p1', '2026-10-01', { dueOn: TODAY }))
    const enrollments = [enrollment('dsa', { startDate: '2026-11-01' })]
    expect(reviewQueue({ catalog: CATALOG, enrollments, items, today: TODAY })).toEqual([])
  })

  it('excludes a track whose catalog entry is not active (M7)', () => {
    const catalog = {
      ...CATALOG,
      tracks: { ...CATALOG.tracks, dsa: { ...CATALOG.tracks.dsa!, status: 'retired' as const } },
    }
    const items = statesOf(itemState('dsa:p1', '2026-10-01', { dueOn: TODAY }, catalog))
    expect(reviewQueue({ catalog, enrollments: [enrollment('dsa')], items, today: TODAY })).toEqual(
      [],
    )
  })

  it('excludes an item whose catalog entry is retired', () => {
    const retiredCatalog = withItems(CATALOG, { 'dsa:p1': { status: 'retired' } })
    const items = statesOf(itemState('dsa:p1', '2026-10-01', { dueOn: TODAY }, retiredCatalog))
    expect(
      reviewQueue({ catalog: retiredCatalog, enrollments: BOTH, items, today: TODAY }),
    ).toEqual([])
  })

  it('excludes a mastered or skipped item', () => {
    const items = statesOf(
      itemState('dsa:p1', '2026-10-01', { status: 'mastered', dueOn: TODAY }),
      itemState('dsa:p2', '2026-10-01', { status: 'skipped', dueOn: TODAY }),
    )
    expect(reviewQueue({ catalog: CATALOG, enrollments: BOTH, items, today: TODAY })).toEqual([])
  })

  it('excludes an item due tomorrow, or with no due date', () => {
    const items = statesOf(
      itemState('dsa:p1', '2026-10-01', { dueOn: '2026-10-11' }),
      itemState('dsa:p2', '2026-10-01', { dueOn: null }),
    )
    expect(reviewQueue({ catalog: CATALOG, enrollments: BOTH, items, today: TODAY })).toEqual([])
  })

  it('`track` filters to that track only', () => {
    const items = statesOf(
      itemState('dsa:p1', '2026-10-01', { dueOn: TODAY }),
      itemState('english:e1', '2026-10-01', { dueOn: TODAY }),
    )
    const result = reviewQueue({
      catalog: CATALOG,
      enrollments: BOTH,
      items,
      today: TODAY,
      track: 'english',
    })
    expect(result.map((entry) => entry.itemId)).toEqual(['english:e1'])
  })

  it('an unknown `track` reads as all', () => {
    const items = statesOf(
      itemState('dsa:p1', '2026-10-01', { dueOn: TODAY }),
      itemState('english:e1', '2026-10-01', { dueOn: TODAY }),
    )
    const result = reviewQueue({
      catalog: CATALOG,
      enrollments: BOTH,
      items,
      today: TODAY,
      track: 'not-a-track',
    })
    expect(result.map((entry) => entry.itemId)).toEqual(['dsa:p1', 'english:e1'])
  })

  it('an ineligible `track` (paused) also reads as all — its own items stay excluded either way', () => {
    const items = statesOf(
      itemState('dsa:p1', '2026-10-01', { dueOn: TODAY }),
      itemState('english:e1', '2026-10-01', { dueOn: TODAY }),
    )
    const enrollments = [enrollment('dsa', { status: 'paused' }), enrollment('english')]
    const result = reviewQueue({
      catalog: CATALOG,
      enrollments,
      items,
      today: TODAY,
      track: 'dsa',
    })
    expect(result.map((entry) => entry.itemId)).toEqual(['english:e1'])
  })

  it('sets trackId, mode, minutes, weak, overdueDays and href', () => {
    const items = statesOf(
      itemState('dsa:p1', '2026-10-01', { weak: true, status: 'weak', dueOn: '2026-10-08' }),
    )
    const result = reviewQueue({ catalog: CATALOG, enrollments: BOTH, items, today: TODAY })
    expect(result).toEqual([
      {
        itemId: 'dsa:p1',
        trackId: 'dsa',
        mode: 'redo',
        minutes: 12,
        weak: true,
        overdueDays: 2,
        href: '/t/dsa/items/p1?mode=redo',
      },
    ])
  })

  it('an empty state: no enrollments or item states', () => {
    expect(reviewQueue({ catalog: CATALOG, enrollments: [], items: {}, today: TODAY })).toEqual([])
  })
})
