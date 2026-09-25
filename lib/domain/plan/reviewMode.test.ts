import { describe, expect, it } from 'vitest'
import { CATALOG, itemState } from './__tests__/fixtures'
import { reviewMode } from './reviewMode'

const DAY = '2026-09-29'

describe('reviewMode (platform design §5.5)', () => {
  it('a weak problem is reviewed by redo', () => {
    const item = CATALOG.items['dsa:p2']!
    const state = itemState('dsa:p2', DAY, { weak: true, status: 'weak' })
    expect(reviewMode(item, state)).toBe('redo')
  })

  it('a non-weak problem is reviewed by quick recall', () => {
    const item = CATALOG.items['dsa:p2']!
    const state = itemState('dsa:p2', DAY)
    expect(reviewMode(item, state)).toBe('recall')
  })

  it('a card is plain review', () => {
    const item = CATALOG.items['english:e1']!
    const state = itemState('english:e1', DAY)
    expect(reviewMode(item, state)).toBe('review')
  })

  it('a weak card is still plain review (cards have no review modes)', () => {
    const item = CATALOG.items['english:e1']!
    const state = itemState('english:e1', DAY, { weak: true, status: 'weak' })
    expect(reviewMode(item, state)).toBe('review')
  })
})
