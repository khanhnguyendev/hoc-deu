/**
 * The English simulation (platform design §5.10; Part B-M4 decisions 20, 21): the real engine, day
 * by day, for 200 realistic learners (seeds 0…199) and one ideal learner, 126 days from Monday
 * 2026-09-28, on the fixed synthetic model (`englishModel.ts`: the §5.10 card counts, 0.9 derived
 * cards a day, the real English template at 25 min, `newPerDay` 8, throttle > 40 → 4, > 60 → 0).
 * The thresholds are the spec's, recalibrated once against this engine in task 4.8 and frozen.
 */
import { describe, expect, it } from 'vitest'
import { SIM_START_DATE } from '../simInputs'
import { type LearnerProfile, percentile, type SimRun, simulate } from '../simulate'
import {
  ENGLISH_EXTERNAL_RESULTS,
  ENGLISH_MODEL_CATALOG,
  englishModelEnrollment,
} from './englishModel'

const RUNS = 200
const DAYS = 126
/** The last simulated day (the prototype's "week 18"). */
const LAST_DAY = DAYS - 1
/** The prototype's `mean(dues[56:])`, which §5.10 labels "w8–12": days 56…125. */
const LATE_FROM = 56

const cache = new Map<LearnerProfile, readonly SimRun[]>()

/** Seeds 0…199 (realistic) or seed 0 (ideal), computed once per file. */
function runsOf(profile: LearnerProfile): readonly SimRun[] {
  const cached = cache.get(profile)
  if (cached !== undefined) return cached
  const seeds = profile === 'ideal' ? [0] : Array.from({ length: RUNS }, (_, seed) => seed)
  const runs = seeds.map((seed) =>
    simulate({
      catalog: ENGLISH_MODEL_CATALOG,
      enrollment: englishModelEnrollment(SIM_START_DATE),
      profile,
      seed,
      days: DAYS,
      startDate: SIM_START_DATE,
      externalResults: ENGLISH_EXTERNAL_RESULTS,
    }),
  )
  cache.set(profile, runs)
  return runs
}

const mean = (values: readonly number[]): number =>
  values.reduce((sum, value) => sum + value, 0) / values.length
const maxDue = (run: SimRun): number => Math.max(...run.days.map((day) => day.due))

describe('English simulation (§5.10)', { timeout: 180_000 }, () => {
  it('realistic: mean due over days 56–125 ("w8–12") ≤ 25', () => {
    const lateMean = mean(
      runsOf('realistic').map((run) => mean(run.days.slice(LATE_FROM).map((day) => day.due))),
    )
    expect(lateMean, `observed ${lateMean.toFixed(1)}`).toBeLessThanOrEqual(25)
  })

  it('realistic: max due p90 ≤ 90', () => {
    const observed = percentile(runsOf('realistic').map(maxDue), 0.9)
    expect(observed, `observed ${observed}`).toBeLessThanOrEqual(90)
  })

  it('realistic: due p90 on day 125 ≤ 25', () => {
    const observed = percentile(
      runsOf('realistic').map((run) => run.days[LAST_DAY]?.due ?? Number.NaN),
      0.9,
    )
    expect(observed, `observed ${observed}`).toBeLessThanOrEqual(25)
  })

  it.each(['ideal', 'realistic'] as const)(
    '%s: every core card introduced by day 125 in every run',
    (profile) => {
      for (const run of runsOf(profile)) {
        expect(run.coreTotal).toBe(135)
        expect(run.coreIntroduced).toBe(run.coreTotal)
      }
    },
  )

  it.each(['ideal', 'realistic'] as const)(
    '%s: every simulated day of every run: planned ≤ budget + the largest item (§5.4)',
    (profile) => {
      const over = runsOf(profile).flatMap((run) => run.days.filter((day) => !day.withinBudget))
      expect(over).toEqual([])
    },
  )
})
