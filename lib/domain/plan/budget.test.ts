import { describe, expect, it } from 'vitest'
import type { Candidate } from './budget'
import {
  EMPTY_SELECTION,
  inReviewDebt,
  REVIEW_DEBT,
  reserveFixed,
  reviewCap,
  selectHalfFit,
  selectSkipping,
  spend,
  startBudget,
} from './budget'

const unit = (itemId: string, minutes: number, extra: Partial<Candidate> = {}): Candidate => ({
  itemId,
  mode: 'recall',
  minutes,
  srs: false,
  ...extra,
})

describe('REVIEW_DEBT / inReviewDebt (§5.10)', () => {
  it('the constant', () => {
    expect(REVIEW_DEBT).toEqual({ overdueDays: 7, capShare: 0.4 })
  })

  it('exactly 7 days overdue is not in debt', () => {
    expect(inReviewDebt([7])).toBe(false)
  })

  it('more than 7 days overdue on any item is in debt', () => {
    expect(inReviewDebt([0, 8])).toBe(true)
  })
})

describe('reviewCap (§5.4 step 3)', () => {
  it.each([
    [15, 60, 60, false, 15],
    [15, 60, 60, true, 24],
    [15, 90, 90, true, 36],
    [15, 60, 10, true, 10],
    [undefined, 60, 45, false, 45],
    [15, 60, -5, false, 0],
  ])(
    'maxMinutes=%s trackBudget=%s remaining=%s debt=%s → %i',
    (maxMinutes, trackBudget, remaining, debt, expected) => {
      expect(reviewCap({ maxMinutes, trackBudget, remaining, debt })).toBe(expected)
    },
  )
})

describe('reserveFixed (§5.4 step 2)', () => {
  it('fits the remaining budget → taken', () => {
    expect(reserveFixed(startBudget(60), 45)).toEqual({ take: true, overshoot: false })
  })

  it('does not fit, overshoot unused → taken as the overshoot', () => {
    expect(reserveFixed(startBudget(30), 45)).toEqual({ take: true, overshoot: true })
  })

  it('does not fit, overshoot already used → dropped', () => {
    const budget = { remaining: 30, overshootUsed: true }
    expect(reserveFixed(budget, 45)).toEqual({ take: false, overshoot: false })
  })
})

describe('selectSkipping (§5.4 steps 3-4)', () => {
  it('skips whatever does not fit, in order, and keeps scanning', () => {
    const candidates = [unit('a', 5), unit('b', 21), unit('c', 5), unit('d', 5), unit('e', 5)]
    const result = selectSkipping(candidates, { cap: 15 })
    expect(result.picked.map((p) => p.itemId)).toEqual(['a', 'c', 'd'])
    expect(result.minutes).toBe(15)
    expect(result.overshoot).toBe(false)
  })

  it('a lead + item unit that does not fit is skipped as a whole', () => {
    const candidates = [unit('item', 21, { lead: unit('lead', 25) })]
    const result = selectSkipping(candidates, { cap: 30 })
    expect(result).toEqual(EMPTY_SELECTION)
  })

  it('maxUnits caps the number of units taken', () => {
    const candidates = [unit('a', 5), unit('b', 5), unit('c', 5), unit('d', 5), unit('e', 5)]
    const result = selectSkipping(candidates, { cap: 100, maxUnits: 3 })
    expect(result.picked.map((p) => p.itemId)).toEqual(['a', 'b', 'c'])
    expect(result.minutes).toBe(15)
  })

  it('forceFirst takes the first unit whatever it costs, flags it, and nothing else fits after it', () => {
    const candidates = [unit('a', 21), unit('b', 5), unit('c', 5)]
    const result = selectSkipping(candidates, { cap: 10, forceFirst: true })
    expect(result.picked).toEqual([{ itemId: 'a', mode: 'recall', minutes: 21, overBudget: true }])
    expect(result.minutes).toBe(21)
    expect(result.overshoot).toBe(true)
  })
})

describe('selectHalfFit (§5.4 step 5)', () => {
  it('takes a unit that fully fits, then one that half-fits, then stops', () => {
    const candidates = [unit('a', 20), unit('b', 35), unit('c', 20)]
    const result = selectHalfFit(candidates, { remaining: 40, newCap: null, forceFirst: false })
    expect(result.picked.map((p) => p.itemId)).toEqual(['a', 'b'])
    expect(result.picked.every((p) => p.overBudget === undefined)).toBe(true)
    expect(result.minutes).toBe(55)
    expect(result.overshoot).toBe(false)
  })

  it('forceFirst takes the first unit whatever it costs and flags it', () => {
    const candidates = [unit('a', 50)]
    const result = selectHalfFit(candidates, { remaining: 10, newCap: null, forceFirst: true })
    expect(result.picked).toEqual([{ itemId: 'a', mode: 'recall', minutes: 50, overBudget: true }])
    expect(result.minutes).toBe(50)
    expect(result.overshoot).toBe(true)
  })

  it('without forceFirst, a first unit that does not half-fit selects nothing', () => {
    const candidates = [unit('a', 50)]
    const result = selectHalfFit(candidates, { remaining: 10, newCap: null, forceFirst: false })
    expect(result).toEqual(EMPTY_SELECTION)
  })

  it('half-fit at the exact boundary is taken', () => {
    const candidates = [unit('a', 5), unit('b', 20)]
    const result = selectHalfFit(candidates, { remaining: 15, newCap: null, forceFirst: false })
    expect(result.picked.map((p) => p.itemId)).toEqual(['a', 'b'])
    expect(result.minutes).toBe(25)
  })

  it('newCap stops SRS units at the cap', () => {
    const candidates = [
      unit('a', 5, { srs: true }),
      unit('b', 5, { srs: true }),
      unit('c', 5, { srs: true }),
      unit('d', 5, { srs: true }),
    ]
    const result = selectHalfFit(candidates, { remaining: 100, newCap: 2, forceFirst: false })
    expect(result.picked.map((p) => p.itemId)).toEqual(['a', 'b'])
  })

  it('newCap 0 allows no SRS unit, even with forceFirst', () => {
    const candidates = [unit('lesson', 10, { srs: false }), unit('card', 5, { srs: true })]
    const result = selectHalfFit(candidates, { remaining: 100, newCap: 0, forceFirst: true })
    expect(result.picked.map((p) => p.itemId)).toEqual(['lesson'])
  })

  it('order is never broken: a small item after a failing big one is not taken', () => {
    const candidates = [unit('big', 50), unit('small', 1)]
    const result = selectHalfFit(candidates, { remaining: 10, newCap: null, forceFirst: false })
    expect(result).toEqual(EMPTY_SELECTION)
  })
})

describe('startBudget / spend', () => {
  it('startBudget', () => {
    expect(startBudget(60)).toEqual({ remaining: 60, overshootUsed: false })
  })

  it('spend subtracts the selection minutes', () => {
    const budget = startBudget(60)
    const selection = { picked: [], minutes: 20, overshoot: false }
    expect(spend(budget, selection)).toEqual({ remaining: 40, overshootUsed: false })
  })

  it('spend marks overshootUsed when the selection overshot', () => {
    const budget = startBudget(10)
    const selection = { picked: [], minutes: 21, overshoot: true }
    expect(spend(budget, selection)).toEqual({ remaining: -11, overshootUsed: true })
  })

  it('spend marks overshootUsed when a half-fit selection leaves remaining negative, even if selection.overshoot is false', () => {
    const budget = startBudget(40)
    const selection = selectHalfFit([unit('a', 20), unit('b', 35), unit('c', 20)], {
      remaining: 40,
      newCap: null,
      forceFirst: false,
    })
    expect(selection.overshoot).toBe(false)
    const spent = spend(budget, selection)
    expect(spent.remaining).toBe(-15)
    expect(spent.overshootUsed).toBe(true)
  })
})
