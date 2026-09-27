import { describe, expect, it } from 'vitest'
import { CATALOG, itemState, statesOf } from './__tests__/fixtures'
import { trackProgressOf } from './trackProgress'

describe('trackProgressOf (Part B-M3 decision 25; the track page and /today, m-1)', () => {
  it('week x of N and the introduced active core items of the variant (retired never count)', () => {
    // DSA 8w: W1 p1 p2 p3, W2 p5 p6 p8 (retired) — 5 active core items.
    expect(trackProgressOf(CATALOG, 'dsa', '8w', {})).toEqual({
      week: 1,
      weeks: 2,
      introduced: 0,
      total: 5,
    })
    const items = statesOf(
      itemState('dsa:p1', '2026-09-20'),
      itemState('dsa:p2', '2026-09-20'),
      itemState('dsa:p3', '2026-09-20'),
      // Retired and not a core item: counted nowhere.
      itemState('dsa:p8', '2026-09-20'),
      itemState('dsa:p4', '2026-09-20'),
    )
    expect(trackProgressOf(CATALOG, 'dsa', '8w', items)).toEqual({
      week: 2,
      weeks: 2,
      introduced: 3,
      total: 5,
    })
  })

  it('a variant without its roadmap, or an unknown track: week 1 of 0, nothing to count', () => {
    const none = { week: 1, weeks: 0, introduced: 0, total: 0 }
    expect(trackProgressOf(CATALOG, 'dsa', '6w', {})).toEqual(none)
    expect(trackProgressOf(CATALOG, 'nope', '8w', {})).toEqual(none)
    // An inherited key is not a track or a variant.
    expect(trackProgressOf(CATALOG, 'toString', '8w', {})).toEqual(none)
    expect(trackProgressOf(CATALOG, 'dsa', 'constructor', {})).toEqual(none)
  })
})
