import { describe, expect, it } from 'vitest'
import { PROJECTION_TABLE, projectFinish } from './projections'

describe('PROJECTION_TABLE', () => {
  it('holds the exact §5.11 rows for dsa/8w', () => {
    expect(PROJECTION_TABLE.dsa?.['8w']).toEqual([
      [45, 16.7, 18.1],
      [60, 11.6, 12.4],
      [75, 9.3, 9.7],
      [90, 7.3, 7.7],
      [120, 5.6, 6.1],
    ])
  })

  it('holds the exact §5.11 rows for dsa/10w', () => {
    expect(PROJECTION_TABLE.dsa?.['10w']).toEqual([
      [45, 22.6, 24.1],
      [60, 16.5, 17.4],
      [75, 12.7, 13.6],
      [90, 10.3, 11.1],
      [120, 7.7, 8.4],
    ])
  })

  it('has no table for english', () => {
    expect(PROJECTION_TABLE.english).toBeUndefined()
  })
})

describe('projectFinish', () => {
  it('interpolates linearly between rows', () => {
    const projection = projectFinish('dsa', '8w', 67.5)
    expect(projection?.medianWeeks).toBeCloseTo(10.45, 9)
    expect(projection?.p90Weeks).toBeCloseTo(11.05, 9)
  })

  it('clamps below the first row', () => {
    expect(projectFinish('dsa', '8w', 30)).toEqual({ medianWeeks: 16.7, p90Weeks: 18.1 })
  })

  it('clamps above the last row', () => {
    expect(projectFinish('dsa', '8w', 200)).toEqual({ medianWeeks: 5.6, p90Weeks: 6.1 })
  })

  it('returns null when the track/variant has no table', () => {
    expect(projectFinish('english', '10w', 25)).toBeNull()
  })

  it('returns null for an unknown track', () => {
    expect(projectFinish('nope', '8w', 60)).toBeNull()
  })
})
