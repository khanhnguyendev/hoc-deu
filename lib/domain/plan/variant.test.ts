import { describe, expect, it } from 'vitest'
import { defaultVariant } from './variant'

const dsaRoadmaps = [{ id: '8w', recommendedBelowMinutes: 75 }, { id: '10w' }]

describe('defaultVariant', () => {
  it.each([
    [60, '8w'],
    [74, '8w'],
    [75, '10w'],
    [120, '10w'],
  ])('%i min/day → %s', (budgetMinutes, expected) => {
    expect(defaultVariant(dsaRoadmaps, budgetMinutes)).toBe(expected)
  })

  it('returns the single roadmap id when there is only one', () => {
    expect(defaultVariant([{ id: '10w' }], 25)).toBe('10w')
  })
})
