import { describe, expect, it } from 'vitest'
import { byId, compareNames, count } from './util'

describe('compareNames', () => {
  it('orders by UTF-16 code units, not by locale (stable on every machine)', () => {
    expect(['b', 'a', 'Z', '8w', '10w'].sort(compareNames)).toEqual(['10w', '8w', 'Z', 'a', 'b'])
    expect(compareNames('x', 'x')).toBe(0)
  })
})

describe('byId', () => {
  it('orders records by their id', () => {
    expect([{ id: 'dsa:lc-0015' }, { id: 'dsa:lc-0001' }].sort(byId)).toEqual([
      { id: 'dsa:lc-0001' },
      { id: 'dsa:lc-0015' },
    ])
  })
})

describe('count', () => {
  it('pluralises the noun unless there is exactly one', () => {
    expect([0, 1, 2].map((n) => count(n, 'week'))).toEqual(['0 weeks', '1 week', '2 weeks'])
  })
})
