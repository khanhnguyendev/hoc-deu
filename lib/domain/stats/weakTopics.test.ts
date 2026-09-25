import { describe, expect, it } from 'vitest'
import { CATALOG, itemState, statesOf } from '../plan/__tests__/fixtures'
import { WEAK_TOPIC_MIN, weakTopics } from './weakTopics'

const DAY = '2026-09-29'

const weak = (itemId: string) => itemState(itemId, DAY, { weak: true, status: 'weak' })

describe('weakTopics (platform design §5.7)', () => {
  it('exports the minimum weak-item count', () => {
    expect(WEAK_TOPIC_MIN).toBe(2)
  })

  it('two weak items of a topic make it weak, items sorted by ID', () => {
    const items = statesOf(weak('dsa:p2'), weak('dsa:p1'))
    expect(weakTopics(items, CATALOG, new Set(['dsa']))).toEqual([
      { trackId: 'dsa', topicId: 'arrays', itemIds: ['dsa:p1', 'dsa:p2'] },
    ])
  })

  it('one weak item alone does not make a topic weak', () => {
    const items = statesOf(weak('dsa:p1'))
    expect(weakTopics(items, CATALOG, new Set(['dsa']))).toEqual([])
  })

  it('a retired weak item does not count toward the threshold', () => {
    // dsa:p8 (two-pointers) is retired in CATALOG; only dsa:p5 is an active weak item there.
    const items = statesOf(weak('dsa:p5'), weak('dsa:p8'))
    expect(weakTopics(items, CATALOG, new Set(['dsa']))).toEqual([])
  })

  it('a track outside trackIds (e.g. paused) is excluded', () => {
    const items = statesOf(weak('english:e5'), weak('english:e6'))
    expect(weakTopics(items, CATALOG, new Set(['dsa']))).toEqual([])
  })

  it('orders topics by item count desc, then trackId, then topicId', () => {
    const items = statesOf(
      weak('dsa:p4'),
      weak('dsa:p1'),
      weak('dsa:p2'),
      weak('dsa:p5'),
      weak('dsa:p6'),
      weak('english:e1'),
      weak('english:e2'),
    )
    expect(weakTopics(items, CATALOG, new Set(['dsa', 'english']))).toEqual([
      { trackId: 'dsa', topicId: 'arrays', itemIds: ['dsa:p1', 'dsa:p2', 'dsa:p4'] },
      { trackId: 'dsa', topicId: 'two-pointers', itemIds: ['dsa:p5', 'dsa:p6'] },
      { trackId: 'english', topicId: 'standup', itemIds: ['english:e1', 'english:e2'] },
    ])
  })
})
