import { describe, expect, it } from 'vitest'
import { compareIds, own } from './compare'

describe('compareIds (Part B-M4 decision 29)', () => {
  it('orders IDs by UTF-16 code unit, not by locale', () => {
    expect(compareIds('dsa:p1', 'dsa:p2')).toBe(-1)
    expect(compareIds('dsa:p2', 'dsa:p1')).toBe(1)
    expect(compareIds('dsa:p1', 'dsa:p1')).toBe(0)
    // Upper case sorts before lower case; a prefix before its extensions.
    expect(['b', 'a', 'B', 'ab'].toSorted(compareIds)).toEqual(['B', 'a', 'ab', 'b'])
    // A digit string compares character by character, not as a number.
    expect(compareIds('dsa:lc-0010', 'dsa:lc-0009')).toBe(1)
    // An astral character (a surrogate pair, 0xD83D…) sorts before U+FF5E by code unit.
    expect(compareIds('\u{1F600}', '～')).toBe(-1)
  })
})

describe('own', () => {
  it('finds an own key', () => {
    expect(own({ 'dsa:p1': 1 }, 'dsa:p1')).toBe(1)
    expect(own({ constructor: 2 }, 'constructor')).toBe(2)
  })

  it('never finds an inherited key such as constructor or __proto__', () => {
    const record: Record<string, number> = { 'dsa:p1': 1 }
    expect(own(record, 'constructor')).toBeUndefined()
    expect(own(record, '__proto__')).toBeUndefined()
    expect(own(record, 'toString')).toBeUndefined()
    expect(own(record, 'dsa:p2')).toBeUndefined()
  })

  it('finds __proto__ when it is an own key', () => {
    const record: Record<string, number> = Object.fromEntries([['__proto__', 3]])
    expect(own(record, '__proto__')).toBe(3)
  })
})
