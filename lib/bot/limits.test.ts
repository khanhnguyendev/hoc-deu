import { describe, expect, it } from 'vitest'
import { HARD_LIMITS as DOMAIN_LIMITS } from '@/lib/domain/bot-limits'
import { effectiveLimits, HARD_LIMITS } from './limits'

describe('HARD_LIMITS (decision 33)', () => {
  it("is lib/domain's constant, re-exported (lib/plans reads it without lib/bot)", () => {
    expect(HARD_LIMITS).toBe(DOMAIN_LIMITS)
  })

  it('are the spec’s hard maxima', () => {
    expect(HARD_LIMITS).toEqual({
      customItemsPerDay: 10,
      customItemsActive: 200,
      overridesPerTrack: 3,
      insertBlockShare: 0.25,
      insertBlockDays: 14,
      extraWeekDays: 5,
      extraWeekCooldownDays: 21,
    })
  })
})

describe('effectiveLimits: stored limits can only lower the hard maxima', () => {
  it('is the hard maxima for an empty object, null or anything that is not an object', () => {
    for (const stored of [{}, null, undefined, 'x', 3, [], [1, 2]]) {
      expect(effectiveLimits(stored)).toEqual(HARD_LIMITS)
    }
  })

  it('takes a lower stored value', () => {
    expect(effectiveLimits({ customItemsPerDay: 4, insertBlockShare: 0.1 })).toEqual({
      ...HARD_LIMITS,
      customItemsPerDay: 4,
      insertBlockShare: 0.1,
    })
  })

  it('clamps a higher stored value to the hard maximum', () => {
    expect(effectiveLimits({ customItemsActive: 5000, extraWeekDays: 6 })).toEqual(HARD_LIMITS)
  })

  it('accepts 0 (turns that write off)', () => {
    expect(effectiveLimits({ overridesPerTrack: 0 }).overridesPerTrack).toBe(0)
  })

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY, '4', true, null, { v: 1 }])(
    'ignores the invalid value %j (the hard maximum stays)',
    (value) => {
      expect(effectiveLimits({ customItemsPerDay: value }).customItemsPerDay).toBe(10)
    },
  )

  it('ignores unknown keys and never returns them', () => {
    const limits = effectiveLimits({ somethingElse: 1, __proto__: { customItemsPerDay: 1 } })
    expect(limits).toEqual(HARD_LIMITS)
    expect(Object.keys(limits).sort()).toEqual(Object.keys(HARD_LIMITS).sort())
  })

  it('never mutates its input', () => {
    const stored = Object.freeze({ customItemsPerDay: 50 })
    effectiveLimits(stored)
    expect(stored).toEqual({ customItemsPerDay: 50 })
  })
})
