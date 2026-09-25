import { describe, expect, it } from 'vitest'
import {
  BUDGET_MINUTES,
  budgetMinutesSchema,
  CODE_LANGUAGES,
  isBudgetMinutes,
  isCodeLanguage,
  MAX_START_DAYS_AHEAD,
  ROADMAP_VARIANT_PATTERN,
} from './settings'

describe('code languages', () => {
  it('are Python, Java and Go, in that order', () => {
    expect(CODE_LANGUAGES).toEqual(['python', 'java', 'go'])
  })

  it('isCodeLanguage accepts exactly those', () => {
    expect(CODE_LANGUAGES.every(isCodeLanguage)).toBe(true)
    expect(isCodeLanguage('rust')).toBe(false)
    expect(isCodeLanguage('Python')).toBe(false)
    expect(isCodeLanguage(null)).toBe(false)
  })
})

describe('budget minutes (decision 22)', () => {
  it('is 10–240 in steps of 5', () => {
    expect(BUDGET_MINUTES).toEqual({ min: 10, max: 240, step: 5 })
  })

  it.each([
    [10, true],
    [25, true],
    [240, true],
    [5, false],
    [62, false],
    [245, false],
    [12.5, false],
    [Number.NaN, false],
  ])('%j → %j', (minutes, expected) => {
    expect(isBudgetMinutes(minutes)).toBe(expected)
  })

  it('reports the given message for every broken rule', () => {
    const schema = budgetMinutesSchema('Từ 10 đến 240, bước 5.')
    for (const value of ['x', 5, 245, 62, 12.5]) {
      const result = schema.safeParse(value)
      expect(result.success).toBe(false)
      expect(new Set(result.error?.issues.map((issue) => issue.message))).toEqual(
        new Set(['Từ 10 đến 240, bước 5.']),
      )
    }
    expect(budgetMinutesSchema().safeParse(60).success).toBe(true)
  })
})

describe('roadmap variants and start dates', () => {
  it('variant IDs follow the database rule for user_tracks.roadmap_variant', () => {
    expect(ROADMAP_VARIANT_PATTERN.test('8w')).toBe(true)
    expect(ROADMAP_VARIANT_PATTERN.test('10w')).toBe(true)
    expect(ROADMAP_VARIANT_PATTERN.test('W8')).toBe(false)
    expect(ROADMAP_VARIANT_PATTERN.test('-8w')).toBe(false)
    expect(ROADMAP_VARIANT_PATTERN.test('a'.repeat(33))).toBe(false)
  })

  it('a future start date is at most 60 days ahead', () => {
    expect(MAX_START_DAYS_AHEAD).toBe(60)
  })
})
