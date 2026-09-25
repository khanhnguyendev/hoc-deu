import { describe, expect, it } from 'vitest'
import { addDays } from './localDay'
import { WEEKDAYS, weekStart, weekdayOf } from './weekday'

describe('weekdayOf', () => {
  it.each([
    ['2026-09-28', 'mon'],
    ['2026-10-04', 'sun'],
    ['2024-02-29', 'thu'],
    ['1969-12-31', 'wed'],
  ] as const)('%s → %s', (day, expected) => {
    expect(weekdayOf(day)).toBe(expected)
  })

  it('agrees with WEEKDAYS order across a full week starting on a known Monday', () => {
    const days = Array.from({ length: 7 }, (_, i) => weekdayOf(addDays('2026-09-28', i)))
    expect(days).toEqual(WEEKDAYS)
  })
})

describe('WEEKDAYS', () => {
  it('lists the seven weekdays starting on Monday', () => {
    expect(WEEKDAYS).toEqual(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])
  })
})

describe('weekStart', () => {
  it('returns the Monday on or before the given day', () => {
    expect(weekStart('2026-10-04')).toBe('2026-09-28')
  })

  it('returns the day itself when it is already a Monday', () => {
    expect(weekStart('2026-09-28')).toBe('2026-09-28')
  })
})
