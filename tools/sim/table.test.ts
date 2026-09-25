import { describe, expect, it } from 'vitest'
import type { SimInputs } from '@/lib/domain/plan/simInputs'
import { RULES_VERSION } from '@/lib/domain/rules'
import { projectionRow } from './table'

/** A two-week roadmap of three Medium problems a week: 260 minutes of new work, at least 3 days
 *  at 60 minutes a day. */
const INPUTS: SimInputs = {
  rulesVersion: RULES_VERSION,
  trackId: 'dsa',
  srs: { intervals: [7, 21, 60], relearnDays: 3, masteredAfter: 2 },
  estimates: { lesson: 25, problem: { E: 20, M: 35, H: 50 } },
  review: { recallMinutes: 5, redoFactor: 0.6 },
  weeklyTemplate: {
    'mon-fri': [{ kind: 'review', maxMinutes: 15 }, { kind: 'new' }],
    sat: [{ kind: 'review' }],
    sun: [{ kind: 'recap', count: 3 }],
  },
  defaults: { budgetMinutes: 60, newPerDay: null, throttle: [] },
  roadmaps: {
    '8w': {
      id: '8w',
      weeks: [
        {
          week: 1,
          topics: ['a'],
          core: ['dsa:p1', 'dsa:p2', 'dsa:p3'],
          bonus: [],
          recap: [],
          decks: [],
        },
        {
          week: 2,
          topics: ['b'],
          core: ['dsa:p4', 'dsa:p5', 'dsa:p6'],
          bonus: [],
          recap: [],
          decks: [],
        },
      ],
    },
  },
  problems: Object.fromEntries(
    ['dsa:p1', 'dsa:p2', 'dsa:p3', 'dsa:p4', 'dsa:p5', 'dsa:p6'].map((id) => [
      id,
      { difficulty: 'M', topic: 'a' },
    ]),
  ),
}

describe('projectionRow', () => {
  it('gives [budget, median, p90] of the realistic finish weeks', () => {
    const result = projectionRow(INPUTS, '8w', 60, { runs: 20, days: 56, rerunDays: 112 })
    expect(result.row).not.toBeNull()
    const [budget, median, p90] = result.row ?? [0, 0, 0]
    expect(budget).toBe(60)
    expect(median).toBeGreaterThanOrEqual(3 / 7)
    expect(median).toBeLessThanOrEqual(p90)
    expect(result.reruns).toBe(0)
    expect(result.unfinished).toEqual([])
  })

  it('reruns a learner who does not finish within `days` for `rerunDays`', () => {
    const result = projectionRow(INPUTS, '8w', 60, { runs: 5, days: 3, rerunDays: 56 })
    expect(result.reruns).toBe(5)
    expect(result.unfinished).toEqual([])
    expect(result.row?.[1]).toBeGreaterThan(3 / 7)
  })

  it('lists the seeds that do not finish within `rerunDays` either', () => {
    const result = projectionRow(INPUTS, '8w', 60, { runs: 3, days: 2, rerunDays: 3 })
    expect(result.unfinished).toEqual([0, 1, 2])
    expect(result.row).toBeNull()
  })
})
