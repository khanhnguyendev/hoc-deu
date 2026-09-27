import { describe, expect, it } from 'vitest'
import { itemHref, itemHrefFromId, itemIdFromRoute, reviewHref } from './href'

describe('itemHref (decision 24)', () => {
  it('links a catalog item by its local ID under its track', () => {
    expect(itemHref({ trackId: 'dsa', localId: 'lc-0001' })).toBe('/t/dsa/items/lc-0001')
  })

  it('encodes the colons of a derived card ID', () => {
    expect(itemHref({ trackId: 'english', localId: 'explaining-code:dsa:lc-0001' })).toBe(
      '/t/english/items/explaining-code%3Adsa%3Alc-0001',
    )
  })
})

describe('itemIdFromRoute', () => {
  it('decodes the route parameter into the item ID', () => {
    expect(itemIdFromRoute('dsa', 'lc-0001')).toBe('dsa:lc-0001')
    expect(itemIdFromRoute('english', 'explaining-code%3Adsa%3Alc-0001')).toBe(
      'english:explaining-code:dsa:lc-0001',
    )
  })

  it('round-trips itemHref, whether or not the router already decoded the parameter', () => {
    for (const [trackId, localId] of [
      ['dsa', 'lesson-two-pointers'],
      ['english', 'explaining-code:dsa:lc-0001'],
    ] as const) {
      const param = itemHref({ trackId, localId }).split('/').at(-1) ?? ''
      expect(itemIdFromRoute(trackId, param)).toBe(`${trackId}:${localId}`)
      expect(itemIdFromRoute(trackId, decodeURIComponent(param))).toBe(`${trackId}:${localId}`)
    }
  })

  it('never throws on a malformed escape: the result matches no item', () => {
    expect(() => itemIdFromRoute('dsa', '%E0%A4%A')).not.toThrow()
    expect(itemIdFromRoute('dsa', '%E0%A4%A')).toBe('dsa:%E0%A4%A')
  })
})

describe('itemHrefFromId (m-2: the one item link from an item ID)', () => {
  it('splits the ID at its first colon: the track, then the local ID (encoded)', () => {
    expect(itemHrefFromId('dsa:lc-0001')).toBe('/t/dsa/items/lc-0001')
    expect(itemHrefFromId('english:explaining-code:dsa:lc-0001')).toBe(
      '/t/english/items/explaining-code%3Adsa%3Alc-0001',
    )
  })

  it('adds the query it is given (a plan block, a mode)', () => {
    expect(itemHrefFromId('dsa:lc-0001', { block: '2026-09-28:dsa:new:1', mode: 'new' })).toBe(
      '/t/dsa/items/lc-0001?block=2026-09-28%3Adsa%3Anew%3A1&mode=new',
    )
    expect(itemHrefFromId('dsa:lc-0001', { mode: 'recall' })).toBe(
      '/t/dsa/items/lc-0001?mode=recall',
    )
  })
})

describe('reviewHref (m-2: the one /review link)', () => {
  it('is /review, or /review?track=<id> for one track', () => {
    expect(reviewHref(null)).toBe('/review')
    expect(reviewHref('english')).toBe('/review?track=english')
  })
})
