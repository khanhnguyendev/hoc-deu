/**
 * The DSA simulation (platform design §5.10; Part B-M4 decisions 20, 21): the real engine, day by
 * day, for 200 realistic learners (seeds 0…199) and one ideal learner per scenario, 126 days from
 * Monday 2026-09-28, on the planned content of `sim-inputs.generated.json` (`simCatalog`). The
 * thresholds are the spec's, recalibrated once against this engine in task 4.8 and frozen: a
 * failure is an engine regression (or a deliberate rules change that needs a ledger ruling), never
 * a reason to loosen a number here.
 */
import { describe, expect, it } from 'vitest'
import simInputsFile from '../sim-inputs.generated.json'
import { SIM_START_DATE, simCatalog, simEnrollment, type SimInputs } from '../simInputs'
import { type LearnerProfile, percentile, type SimRun, simulate } from '../simulate'

/** `tools/sim/projections.test.ts` keeps the file equal to `simInputs(CATALOG)` (typed). */
const INPUTS = simInputsFile as SimInputs
const CATALOG = simCatalog(INPUTS)

const RUNS = 200
const DAYS = 126
/** The last simulated day (the prototype's "week 18"). */
const LAST_DAY = DAYS - 1
/** An unfinished run counts as 99 weeks, as in the prototype. */
const UNFINISHED_WEEKS = 99

type Scenario = { readonly variant: string; readonly budget: number }

const cache = new Map<string, readonly SimRun[]>()

/** The scenario's runs: seeds 0…199 (realistic) or seed 0 (ideal), computed once per file. */
function runsOf({ variant, budget }: Scenario, profile: LearnerProfile): readonly SimRun[] {
  const key = `${variant}@${budget}:${profile}`
  const cached = cache.get(key)
  if (cached !== undefined) return cached
  const enrollment = simEnrollment(INPUTS, variant, budget)
  const seeds = profile === 'ideal' ? [0] : Array.from({ length: RUNS }, (_, seed) => seed)
  const runs = seeds.map((seed) =>
    simulate({
      catalog: CATALOG,
      enrollment,
      profile,
      seed,
      days: DAYS,
      startDate: SIM_START_DATE,
    }),
  )
  cache.set(key, runs)
  return runs
}

const finishWeeks = (run: SimRun): number =>
  run.finishDay === null ? UNFINISHED_WEEKS : (run.finishDay + 1) / 7
const maxDue = (run: SimRun): number => Math.max(...run.days.map((day) => day.due))
const dueOn = (run: SimRun, index: number): number => run.days[index]?.due ?? Number.NaN

/** Median, p90 and max finish weeks, as the report states them. */
function finish(runs: readonly SimRun[]) {
  const weeks = runs.map(finishWeeks)
  return {
    median: percentile(weeks, 0.5),
    p90: percentile(weeks, 0.9),
    max: Math.max(...weeks),
    unfinished: runs.filter((run) => run.finishDay === null).length,
  }
}

const describeFinish = (observed: ReturnType<typeof finish>): string =>
  `observed median ${observed.median}, p90 ${observed.p90}, max ${observed.max.toFixed(2)}, ` +
  `unfinished ${observed.unfinished}/${RUNS}`

const DEFAULT: Scenario = { variant: '8w', budget: 60 }
const TEN_WEEKS_75: Scenario = { variant: '10w', budget: 75 }
const TEN_WEEKS_90: Scenario = { variant: '10w', budget: 90 }
const TEN_WEEKS_60: Scenario = { variant: '10w', budget: 60 }

describe('DSA simulation (§5.10)', { timeout: 180_000 }, () => {
  it('8w @ 60 min realistic (the default): finish p90 ≤ 12.5 weeks, max ≤ 13.5', () => {
    const observed = finish(runsOf(DEFAULT, 'realistic'))
    expect(observed.p90, describeFinish(observed)).toBeLessThanOrEqual(12.5)
    expect(observed.max, describeFinish(observed)).toBeLessThanOrEqual(13.5)
  })

  it('10w @ 90 min realistic: finish p90 ≤ 11.5 weeks', () => {
    const observed = finish(runsOf(TEN_WEEKS_90, 'realistic'))
    expect(observed.p90, describeFinish(observed)).toBeLessThanOrEqual(11.5)
  })

  it('10w @ 75 min realistic: finish p90 ≤ 14 weeks', () => {
    const observed = finish(runsOf(TEN_WEEKS_75, 'realistic'))
    expect(observed.p90, describeFinish(observed)).toBeLessThanOrEqual(14)
  })

  it('ideal: 8w @ 60 ≤ 8.5 weeks, 10w @ 90 ≤ 7.5 weeks', () => {
    const [eightWeeks] = runsOf(DEFAULT, 'ideal').map(finishWeeks)
    const [tenWeeks] = runsOf(TEN_WEEKS_90, 'ideal').map(finishWeeks)
    expect(eightWeeks, `8w @ 60 observed ${eightWeeks}`).toBeLessThanOrEqual(8.5)
    expect(tenWeeks, `10w @ 90 observed ${tenWeeks}`).toBeLessThanOrEqual(7.5)
  })

  it.each([DEFAULT, TEN_WEEKS_75, TEN_WEEKS_90])(
    'backlog, $variant @ $budget min realistic: max due p90 ≤ 40, due p90 on day 125 ≤ 15',
    (scenario) => {
      const runs = runsOf(scenario, 'realistic')
      const maxDueP90 = percentile(runs.map(maxDue), 0.9)
      const lastDueP90 = percentile(
        runs.map((run) => dueOn(run, LAST_DAY)),
        0.9,
      )
      const message = `observed max due p90 ${maxDueP90}, due p90 on day ${LAST_DAY} ${lastDueP90}`
      expect(maxDueP90, message).toBeLessThanOrEqual(40)
      expect(lastDueP90, message).toBeLessThanOrEqual(15)
    },
  )

  it('snapshot (documents §5.11): 10w @ 60 min realistic median > 12 weeks', () => {
    const observed = finish(runsOf(TEN_WEEKS_60, 'realistic'))
    expect(observed.median, describeFinish(observed)).toBeGreaterThan(12)
  })

  it('every simulated day of every run: planned ≤ budget + the largest item (§5.4)', () => {
    for (const scenario of [DEFAULT, TEN_WEEKS_75, TEN_WEEKS_90, TEN_WEEKS_60]) {
      for (const profile of ['ideal', 'realistic'] as const) {
        const over = runsOf(scenario, profile).flatMap((run) =>
          run.days.filter((day) => !day.withinBudget),
        )
        expect(over, `${scenario.variant} @ ${scenario.budget} ${profile}`).toEqual([])
      }
    }
  })
})
