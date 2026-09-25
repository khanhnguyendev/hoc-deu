import { describe, expect, it } from 'vitest'
import { itemHref, itemIdFromRoute } from './href'

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
