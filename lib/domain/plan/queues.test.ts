import { describe, expect, it } from 'vitest'
import type { ItemState } from '../state'
import { CATALOG, itemState, statesOf, withItems } from './__tests__/fixtures'
import { dueQueue } from './queues'

const TODAY = '2026-10-10'
const WEAK_ARRAYS = new Set(['arrays'])

describe('dueQueue (platform design §5.4 step 3)', () => {
  it('sorts Weak first, then weak-topic items, then most overdue, then lowest level, then ID', () => {
    const items = statesOf(
      itemState('dsa:p1', '2026-10-01', { weak: true, status: 'weak', dueOn: '2026-10-08' }),
      itemState('dsa:p2', '2026-10-01', { weak: true, status: 'weak', dueOn: TODAY }),
      itemState('dsa:p3', '2026-10-01', { dueOn: TODAY }),
      itemState('dsa:p5', '2026-10-01', { dueOn: '2026-10-05' }),
      itemState('dsa:p6', '2026-10-01', { dueOn: TODAY, level: 1 }),
      itemState('dsa:p7', '2026-10-01', { dueOn: TODAY, level: 2 }),
    )

    const result = dueQueue({
      trackId: 'dsa',
      items,
      catalog: CATALOG,
      today: TODAY,
      weakTopicIds: WEAK_ARRAYS,
    })

    expect(result.map((entry) => entry.itemId)).toEqual([
      'dsa:p1',
      'dsa:p2',
      'dsa:p3',
      'dsa:p5',
      'dsa:p6',
      'dsa:p7',
    ])
  })

  it('sets overdueDays, mode and minutes (redo for a weak Medium problem, recall otherwise)', () => {
    const items = statesOf(
      itemState('dsa:p1', '2026-10-01', { weak: true, status: 'weak', dueOn: '2026-10-08' }),
      itemState('dsa:p2', '2026-10-01', { weak: true, status: 'weak', dueOn: TODAY }),
      itemState('dsa:p3', '2026-10-01', { dueOn: TODAY }),
      itemState('dsa:p5', '2026-10-01', { dueOn: '2026-10-05' }),
    )

    const result = dueQueue({
      trackId: 'dsa',
      items,
      catalog: CATALOG,
      today: TODAY,
      weakTopicIds: WEAK_ARRAYS,
    })
    const byId = Object.fromEntries(result.map((entry) => [entry.itemId, entry]))

    expect(byId['dsa:p1']).toMatchObject({ overdueDays: 2, mode: 'redo', minutes: 12 })
    expect(byId['dsa:p2']).toMatchObject({ overdueDays: 0, mode: 'redo', minutes: 21 })
    expect(byId['dsa:p3']).toMatchObject({ overdueDays: 0, mode: 'recall', minutes: 5 })
    expect(byId['dsa:p5']).toMatchObject({ overdueDays: 5, mode: 'recall', minutes: 5 })
  })

  it('a non-weak flashcard reviews at 0.5 minutes', () => {
    const items = statesOf(itemState('english:e1', '2026-10-01', { dueOn: TODAY }))
    const result = dueQueue({
      trackId: 'english',
      items,
      catalog: CATALOG,
      today: TODAY,
      weakTopicIds: new Set(),
    })
    expect(result).toMatchObject([{ itemId: 'english:e1', mode: 'review', minutes: 0.5 }])
  })

  it('excludes an item due tomorrow', () => {
    const items = statesOf(itemState('dsa:p1', '2026-10-01', { dueOn: '2026-10-11' }))
    expect(
      dueQueue({ trackId: 'dsa', items, catalog: CATALOG, today: TODAY, weakTopicIds: new Set() }),
    ).toEqual([])
  })

  it('excludes a mastered item', () => {
    const items = statesOf(itemState('dsa:p1', '2026-10-01', { status: 'mastered', dueOn: TODAY }))
    expect(
      dueQueue({ trackId: 'dsa', items, catalog: CATALOG, today: TODAY, weakTopicIds: new Set() }),
    ).toEqual([])
  })

  it('excludes a skipped item', () => {
    const items = statesOf(itemState('dsa:p1', '2026-10-01', { status: 'skipped', dueOn: TODAY }))
    expect(
      dueQueue({ trackId: 'dsa', items, catalog: CATALOG, today: TODAY, weakTopicIds: new Set() }),
    ).toEqual([])
  })

  it('excludes an item whose catalog entry is retired', () => {
    const retiredCatalog = withItems(CATALOG, { 'dsa:p4': { status: 'retired' } })
    const items = statesOf(itemState('dsa:p4', '2026-10-01', { dueOn: TODAY }, retiredCatalog))
    expect(
      dueQueue({
        trackId: 'dsa',
        items,
        catalog: retiredCatalog,
        today: TODAY,
        weakTopicIds: new Set(),
      }),
    ).toEqual([])
  })

  it('excludes an item of another track', () => {
    const items = statesOf(itemState('english:e1', '2026-10-01', { dueOn: TODAY }))
    expect(
      dueQueue({ trackId: 'dsa', items, catalog: CATALOG, today: TODAY, weakTopicIds: new Set() }),
    ).toEqual([])
  })

  it('excludes an item state not in the catalog', () => {
    const ghost: ItemState = {
      itemId: 'dsa:ghost',
      trackId: 'dsa',
      topicId: null,
      itemType: 'problem',
      level: 1,
      weak: false,
      topSuccesses: 0,
      status: 'ok',
      dueOn: TODAY,
      lastResult: 'solved',
      lastResultOn: '2026-10-01',
      introducedOn: '2026-10-01',
      lapses: 0,
      reps: 1,
    }
    expect(
      dueQueue({
        trackId: 'dsa',
        items: statesOf(ghost),
        catalog: CATALOG,
        today: TODAY,
        weakTopicIds: new Set(),
      }),
    ).toEqual([])
  })
})
