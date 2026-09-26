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

  it('sorts weak-topic items next (before an equally overdue item of a non-weak topic)', () => {
    const items = statesOf(
      itemState('dsa:p1', '2026-10-01', { weak: true, status: 'weak', dueOn: TODAY }),
      itemState('dsa:p2', '2026-10-01', { weak: true, status: 'weak', dueOn: TODAY }),
      itemState('dsa:p3', '2026-10-01', { dueOn: TODAY }),
      itemState('dsa:p5', '2026-10-01', { dueOn: TODAY }),
    )
    const result = reviewQueue({ catalog: CATALOG, enrollments: BOTH, items, today: TODAY })
    expect(result.map((entry) => entry.itemId)).toEqual(['dsa:p1', 'dsa:p2', 'dsa:p3', 'dsa:p5'])
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

  it('an unknown or inactive `track` reads as all', () => {
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
