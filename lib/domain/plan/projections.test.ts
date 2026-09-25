import { describe, expect, it } from 'vitest'
import {
  PROJECTION_TABLE,
  type ProjectionTable,
  projectFinish,
  projectFinishIn,
} from './projections'
import generated from './projections.generated.json'

/** A hand-built table: the lookup is tested on it, not on the generated numbers. */
const TABLE: ProjectionTable = {
  dsa: {
    '8w': [
      [45, 16, 18],
      [60, 12, 13],
      [90, 7, 8],
    ],
    '10w': [[60, 16, 17]],
  },
}

describe('projectFinishIn', () => {
  it('interpolates linearly between rows', () => {
    const projection = projectFinishIn(TABLE, 'dsa', '8w', 52.5)
    expect(projection?.medianWeeks).toBeCloseTo(14, 9)
    expect(projection?.p90Weeks).toBeCloseTo(15.5, 9)
    const upper = projectFinishIn(TABLE, 'dsa', '8w', 70)
    expect(upper?.medianWeeks).toBeCloseTo(12 - 5 / 3, 9)
    expect(upper?.p90Weeks).toBeCloseTo(13 - 5 / 3, 9)
  })

  it('returns a row exactly at its budget', () => {
    expect(projectFinishIn(TABLE, 'dsa', '8w', 60)).toEqual({ medianWeeks: 12, p90Weeks: 13 })
  })

  it('clamps below the first row and above the last', () => {
    expect(projectFinishIn(TABLE, 'dsa', '8w', 30)).toEqual({ medianWeeks: 16, p90Weeks: 18 })
    expect(projectFinishIn(TABLE, 'dsa', '8w', 200)).toEqual({ medianWeeks: 7, p90Weeks: 8 })
  })

  it('uses a single row for every budget', () => {
    expect(projectFinishIn(TABLE, 'dsa', '10w', 120)).toEqual({ medianWeeks: 16, p90Weeks: 17 })
  })

  it('returns null for a track or variant without rows', () => {
    expect(projectFinishIn(TABLE, 'english', '10w', 25)).toBeNull()
    expect(projectFinishIn(TABLE, 'dsa', '12w', 60)).toBeNull()
    expect(projectFinishIn({ dsa: { '8w': [] } }, 'dsa', '8w', 60)).toBeNull()
  })
})

describe('PROJECTION_TABLE (projections.generated.json, pnpm sim:projections)', () => {
  it('is the generated table', () => {
    expect(PROJECTION_TABLE).toEqual(generated.table)
  })

  it('has DSA 8w and 10w rows for 45, 60, 75, 90 and 120 min/day, and no English table', () => {
    for (const variant of ['8w', '10w']) {
      expect(PROJECTION_TABLE.dsa?.[variant]?.map(([budget]) => budget)).toEqual([
        45, 60, 75, 90, 120,
      ])
    }
    expect(PROJECTION_TABLE.english).toBeUndefined()
  })

  it('has every row sorted by budget, with 0 < median ≤ p90', () => {
    for (const variants of Object.values(PROJECTION_TABLE)) {
      for (const rows of Object.values(variants)) {
        rows.forEach(([budget, median, p90], index) => {
          expect(budget).toBeGreaterThan(rows[index - 1]?.[0] ?? 0)
          expect(median).toBeGreaterThan(0)
          expect(median).toBeLessThanOrEqual(p90)
        })
      }
    }
  })
})

describe('projectFinish', () => {
  it('looks up the generated table', () => {
    const row = PROJECTION_TABLE.dsa?.['8w']?.find(([budget]) => budget === 60)
    expect(projectFinish('dsa', '8w', 60)).toEqual({ medianWeeks: row?.[1], p90Weeks: row?.[2] })
    expect(projectFinish('dsa', '8w', 67.5)).toEqual(
      projectFinishIn(PROJECTION_TABLE, 'dsa', '8w', 67.5),
    )
  })

  it('returns null for English and an unknown track', () => {
    expect(projectFinish('english', '10w', 25)).toBeNull()
    expect(projectFinish('nope', '8w', 60)).toBeNull()
  })
})
