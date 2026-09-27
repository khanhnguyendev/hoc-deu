import { describe, expect, it } from 'vitest'
import { CATALOG, enrollment, MONDAY } from './__tests__/fixtures'
import { percentile, type SimDay, type SimOptions, type SimRun, simulate } from './simulate'

const dsa = (change: Partial<SimOptions> = {}): SimOptions => ({
  catalog: CATALOG,
  enrollment: enrollment('dsa'),
  profile: 'ideal',
  seed: 0,
  days: 21,
  startDate: MONDAY,
  ...change,
})

/** The 7-day blocks of a run's days (the last one may be shorter). */
const blocksOf = (days: readonly SimDay[]): SimDay[][] =>
  Array.from({ length: Math.ceil(days.length / 7) }, (_, block) =>
    days.slice(block * 7, block * 7 + 7),
  )

describe('percentile', () => {
  it('interpolates linearly between order statistics, like the prototype`s pct', () => {
    expect(percentile([1, 2, 3, 4], 0.5)).toBe(2.5)
    expect(percentile([4, 1, 3, 2], 0.5)).toBe(2.5)
    expect(percentile([5], 0.9)).toBe(5)
    expect(percentile([10, 20], 0.9)).toBe(19)
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.9)).toBe(9.1)
  })

  it('rounds to 0.1 and takes the ends at q = 0 and q = 1', () => {
    expect(percentile([1, 1.26], 0.5)).toBe(1.1)
    expect(percentile([3, 9, 7], 0)).toBe(3)
    expect(percentile([3, 9, 7], 1)).toBe(9)
  })

  it('never reorders its input', () => {
    const values = Object.freeze([3, 1, 2])
    percentile(values, 0.5)
    expect(values).toEqual([3, 1, 2])
  })

  it('throws on no values', () => {
    expect(() => percentile([], 0.5)).toThrow()
  })
})

describe('simulate — ideal learner', () => {
  const run = simulate(dsa())

  it('finishes the two-week fixture roadmap (the retired p8 never blocks it)', () => {
    expect(run.finishDay).not.toBeNull()
    expect(run.finishDay).toBeLessThan(21)
    // p1, p2, p3, p5, p6 — p8 is retired, so it is not a core item.
    expect(run.coreTotal).toBe(5)
    expect(run.coreIntroduced).toBe(5)
  })

  it('studies every day from a new plan, within budget', () => {
    expect(run.days).toHaveLength(21)
    expect(run.days.map((day) => day.date).slice(0, 2)).toEqual(['2026-09-28', '2026-09-29'])
    for (const day of run.days) {
      expect(day.studied).toBe(true)
      expect(day.planDate).toBe(day.date)
      expect(day.withinBudget).toBe(true)
      expect(day.plannedMinutes).toBeLessThanOrEqual(60 + day.largestItem)
    }
  })

  it('starts with nothing due', () => {
    expect(run.days[0]?.due).toBe(0)
  })

  it('reports a null finishDay when the roadmap is not finished within the days', () => {
    expect(simulate(dsa({ days: 1 })).finishDay).toBeNull()
  })

  it('never modifies its inputs', () => {
    const options = Object.freeze(dsa({ days: 7 }))
    expect(() => simulate(options)).not.toThrow()
  })
})

describe('simulate — realistic learner', () => {
  const options = dsa({ profile: 'realistic', seed: 7, days: 28 })
  const run: SimRun = simulate(options)

  it('is deterministic for a seed', () => {
    expect(simulate(options)).toEqual(run)
    expect(simulate({ ...options, seed: 8 })).not.toEqual(run)
  })

  it('a longer run extends a shorter one with the same seed', () => {
    const longer = simulate({ ...options, days: 35 })
    expect(longer.days.slice(0, 28)).toEqual(run.days)
  })

  it('skips exactly one day per 7-day block', () => {
    for (const block of blocksOf(run.days)) {
      expect(block.filter((day) => !day.studied)).toHaveLength(1)
    }
  })

  it('never creates two plans on one day', () => {
    const planDates = run.days.flatMap((day) => (day.planDate === null ? [] : [day.planDate]))
    expect(new Set(planDates).size).toBe(planDates.length)
    for (const day of run.days) {
      if (day.planDate !== null) expect(day.planDate).toBe(day.date)
    }
  })

  it('resumes the paused plan the day after a skip, without a new plan that day', () => {
    let resumes = 0
    run.days.forEach((day, index) => {
      const next = run.days[index + 1]
      // A skip leaves a plan paused when the day's plan had work, or when the gate was already
      // closed (a second skip in a row).
      const paused = !day.studied && (day.plannedMinutes > 0 || day.planDate === null)
      if (next === undefined || !paused) return
      if (!next.studied) return // two skips in a row: the resume comes after the second one
      expect(next.planDate).toBeNull()
      resumes += 1
    })
    expect(resumes).toBeGreaterThan(0)
  })

  it('stays within budget every day', () => {
    expect(run.days.every((day) => day.withinBudget)).toBe(true)
  })
})

describe('simulate — externalResults', () => {
  const english = (change: Partial<SimOptions> = {}): SimOptions => ({
    catalog: CATALOG,
    enrollment: enrollment('english'),
    profile: 'ideal',
    seed: 0,
    days: 7,
    startDate: MONDAY,
    ...change,
  })

  it('unlocks derived cards as their sources gain a result', () => {
    // Without sources, the 8 authored cards all start on day 0 and are reviewed on day 1, so
    // nothing is due on day 2.
    expect(simulate(english()).days[2]?.due).toBe(0)
    // With dsa:p1 solved before day 0 and dsa:p2 before day 1, day 0 takes 8 of the 9 queued
    // cards (newPerDay 8) and day 1 the other own card and p2's derived card — both due on day 2.
    const unlocked = simulate(
      english({ externalResults: { itemIds: ['dsa:p1', 'dsa:p2'], perDay: 1 } }),
    )
    expect(unlocked.days[2]?.due).toBe(2)
  })

  it('throws on an event the engine ignores, naming the reason (4.8 minor)', () => {
    const unknown = english({ externalResults: { itemIds: ['english:nope'], perDay: 1 } })
    expect(() => simulate(unknown)).toThrow(/ignored.*english:nope.*unknown_item/)
  })
})
