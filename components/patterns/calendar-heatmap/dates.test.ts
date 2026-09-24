import { describe, expect, it } from 'vitest'
import { addDays, addMonths, monthGrid, startOfWeek, weekdayIndex, yearColumns } from './dates'

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
