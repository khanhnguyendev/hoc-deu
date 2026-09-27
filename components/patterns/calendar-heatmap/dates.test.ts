import { describe, expect, it } from 'vitest'
import {
  addDays,
  addMonths,
  monthGrid,
  pickMonthLabels,
  startOfWeek,
  weekdayIndex,
  yearColumns,
} from './dates'

describe('local-day arithmetic (UTC, Monday first)', () => {
  it('numbers weekdays from Monday', () => {
    expect(weekdayIndex('2026-02-02')).toBe(0)
    expect(weekdayIndex('2026-02-08')).toBe(6)
    expect(startOfWeek('2026-02-08')).toBe('2026-02-02')
  })

  it.each([
    ['2026-12-31', 1, '2027-01-01'],
    ['2026-03-01', -1, '2026-02-28'],
    ['2028-03-01', -1, '2028-02-29'],
    ['2026-02-04', -7, '2026-01-28'],
  ])('%s + %i days = %s', (day, n, expected) => {
    expect(addDays(day, n)).toBe(expected)
  })

  it('moves to the first day of another month', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-01')
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-01')
  })

  it('lays a month out in Monday-first weeks', () => {
    const grid = monthGrid('2026-02-10') // 1 Feb 2026 is a Sunday
    expect(grid).toHaveLength(35)
    expect(grid.slice(0, 6)).toEqual([null, null, null, null, null, null])
    expect(grid[6]).toBe('2026-02-01')
    expect(grid[33]).toBe('2026-02-28')
    expect(grid[34]).toBeNull()
  })

  it('builds 53 week columns ending with the week of today', () => {
    const columns = yearColumns('2026-02-04')
    expect(columns).toHaveLength(53)
    expect(columns[0]?.[0]).toBe('2025-02-03')
    expect(columns[52]).toEqual(['2026-02-02', '2026-02-03', '2026-02-04', null, null, null, null])
  })
})

// M1 #9: the year view's month labels must never overlap. The bug was column 0's fallback label
// (always shown, regardless of whether it is a month's first day) sitting right next to the true
// next month's label when the display window opens just before a month boundary — one column (or
// two) later, well inside the label's own rendered width. `pickMonthLabels` drops any label too
// close to the previous one it kept.
describe('pickMonthLabels (M1 #9)', () => {
  it('always labels column 0, and every later label is a real first-of-month', () => {
    const columns = yearColumns('2026-02-04')
    const labels = pickMonthLabels(columns)
    expect(labels[0]).toEqual({ index: 0, day: columns[0]?.[0] })
    for (const { index, day } of labels.slice(1)) {
      expect(day.endsWith('-01')).toBe(true)
      expect(columns[index]).toContain(day)
    }
  })

  it('never places two labels closer than the minimum gap, for any start weekday', () => {
    // One `today` per weekday (Monday .. Sunday), so the display window can open on any weekday.
    const today = [
      '2026-02-02',
      '2026-02-03',
      '2026-02-04',
      '2026-02-05',
      '2026-02-06',
      '2026-02-07',
      '2026-02-08',
    ]
    for (const day of today) {
      const columns = yearColumns(day)
      const labels = pickMonthLabels(columns)
      for (let i = 1; i < labels.length; i += 1) {
        const gap = labels[i]!.index - labels[i - 1]!.index
        expect(
          gap,
          `start weekday ${weekdayIndex(day)}, labels ${JSON.stringify(labels)}`,
        ).toBeGreaterThanOrEqual(3)
      }
    }
  })

  it('still labels every distinct month once the fallback stops crowding it out', () => {
    // A window opening well inside a month (no boundary right after column 0) labels every month.
    const columns = yearColumns('2026-02-04')
    const labels = pickMonthLabels(columns)
    const months = new Set(labels.map(({ day }) => day.slice(0, 7)))
    expect(months.size).toBeGreaterThanOrEqual(11)
  })
})
