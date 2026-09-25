import { describe, expect, it } from 'vitest'
import type { ThrottleRule } from '../catalog'
import { effectiveNewPerDay } from './throttle'

const ENGLISH_RULES: readonly ThrottleRule[] = [
  { dueAbove: 40, newPerDay: 4 },
  { dueAbove: 60, newPerDay: 0 },
]

describe('effectiveNewPerDay (§5.5)', () => {
  it.each([
    [40, 8],
    [41, 4],
    [60, 4],
    [61, 0],
  ])('dueCount %i → %i', (dueCount, expected) => {
    expect(effectiveNewPerDay(8, ENGLISH_RULES, dueCount)).toBe(expected)
  })

  it('picks the matching rule with the highest dueAbove, whatever order the rules are given', () => {
    const reversed = [...ENGLISH_RULES].reverse()
    expect(effectiveNewPerDay(8, reversed, 61)).toBe(0)
  })

  it('no rules and no cap → null', () => {
    expect(effectiveNewPerDay(null, [], 500)).toBeNull()
  })

  it('a matching rule overrides a null newPerDay', () => {
    expect(effectiveNewPerDay(null, [{ dueAbove: 10, newPerDay: 2 }], 11)).toBe(2)
  })
})
