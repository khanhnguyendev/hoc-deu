/**
 * The §5.12 simulation scenario (platform design §5.12 last bullet, §5.10; Part B-M4 decision 31;
 * task 6.6b): the realistic learner of `simulation.dsa.test.ts` with one `extra_week` per four
 * roadmap weeks and two `insert_block`s active at all times (`personalizedOverrides`, every
 * override accepted by `validateOverride`). It asserts the planned-minutes invariant and the §5.10
 * backlog bounds; the finish time may grow — it is printed, never asserted.
 *
 * `pnpm test:sim` (`SIM_FULL=1`) runs 200 seeds per scenario; `pnpm test` runs one seed of the
 * default scenario (8w @ 60): the invariant, no event the engine ignores, and that the overrides
 * really shaped the plans.
 */
import { describe, expect, it } from 'vitest'
import simInputsFile from '../sim-inputs.generated.json'
import { SIM_START_DATE, simCatalog, simEnrollment, type SimInputs } from '../simInputs'
import {
  type OverrideStats,
  percentile,
  personalizedOverrides,
  type SimRun,
  simulate,
} from '../simulate'

const INPUTS = simInputsFile as SimInputs
const CATALOG = simCatalog(INPUTS)

const FULL = process.env.SIM_FULL === '1'
const RUNS = FULL ? 200 : 1
const DAYS = 126
const LAST_DAY = DAYS - 1
const UNFINISHED_WEEKS = 99

type Scenario = { readonly variant: string; readonly budget: number }
type Result = { readonly run: SimRun; readonly stats: OverrideStats }

const DEFAULT: Scenario = { variant: '8w', budget: 60 }
const TEN_WEEKS_75: Scenario = { variant: '10w', budget: 75 }
const TEN_WEEKS_90: Scenario = { variant: '10w', budget: 90 }
const SCENARIOS = FULL ? [DEFAULT, TEN_WEEKS_75, TEN_WEEKS_90] : [DEFAULT]

const cache = new Map<string, readonly Result[]>()

/** The scenario's realistic runs with overrides, seeds 0…RUNS − 1, computed once per file. */
function runsOf(scenario: Scenario): readonly Result[] {
  const key = `${scenario.variant}@${scenario.budget}`
  const cached = cache.get(key)
  if (cached !== undefined) return cached
  const enrollment = simEnrollment(INPUTS, scenario.variant, scenario.budget)
  const results = Array.from({ length: RUNS }, (_, seed) => {
    const overrides = personalizedOverrides(CATALOG, enrollment)
    const run = simulate({
      catalog: CATALOG,
      enrollment,
      profile: 'realistic',
      seed,
      days: DAYS,
      startDate: SIM_START_DATE,
      overrides,
    })
    return { run, stats: overrides.stats() }
  })
  cache.set(key, results)
  return results
}

const finishWeeks = (run: SimRun): number =>
  run.finishDay === null ? UNFINISHED_WEEKS : (run.finishDay + 1) / 7
const maxDue = (run: SimRun): number => Math.max(...run.days.map((day) => day.due))

/** The finish time and backlog, as the report states them (printed; finish never asserted). */
function report(scenario: Scenario, results: readonly Result[]): string {
  const weeks = results.map(({ run }) => finishWeeks(run))
  const unfinished = results.filter(({ run }) => run.finishDay === null).length
  return (
    `§5.12 scenario ${scenario.variant} @ ${scenario.budget} min, ${RUNS} realistic seed(s): ` +
    `finish median ${percentile(weeks, 0.5)}, p90 ${percentile(weeks, 0.9)}, ` +
    `max ${Math.max(...weeks).toFixed(2)} weeks, unfinished ${unfinished}/${RUNS}; ` +
    `max due p90 ${percentile(
      results.map(({ run }) => maxDue(run)),
      0.9,
    )}, due p90 on day ` +
    `${LAST_DAY} ${percentile(
      results.map(({ run }) => run.days[LAST_DAY]?.due ?? Number.NaN),
      0.9,
    )}; extra weeks per run median ` +
    `${percentile(
      results.map(({ stats }) => stats.extraWeeks),
      0.5,
    )}`
  )
}

describe(`§5.12 simulation scenario (overrides), ${RUNS} seed(s)`, { timeout: 600_000 }, () => {
  it.each(SCENARIOS)(
    '$variant @ $budget: every simulated day keeps planned ≤ budget + the largest item (§5.4)',
    (scenario) => {
      const results = runsOf(scenario)
      console.log(report(scenario, results))
      const over = results.flatMap(({ run }) => run.days.filter((day) => !day.withinBudget))
      expect(over).toEqual([])
    },
  )

  it('the overrides shape the plans: extra weeks are taken and override blocks planned', () => {
    for (const { stats } of runsOf(DEFAULT)) {
      expect(stats.extraWeeks).toBeGreaterThanOrEqual(1)
      expect(stats.extraWeekPlans).toBeGreaterThanOrEqual(1)
      expect(stats.topicPracticeBlocks).toBeGreaterThan(0)
      expect(stats.insertBlocks).toBeGreaterThanOrEqual(2)
    }
  })

  it.runIf(FULL).each([DEFAULT, TEN_WEEKS_75, TEN_WEEKS_90])(
    '$variant @ $budget backlog (§5.10): max due p90 ≤ 40, due p90 on day 125 ≤ 15',
    (scenario) => {
      const runs = runsOf(scenario).map(({ run }) => run)
      const maxDueP90 = percentile(runs.map(maxDue), 0.9)
      const lastDueP90 = percentile(
        runs.map((run) => run.days[LAST_DAY]?.due ?? Number.NaN),
        0.9,
      )
      const message = `observed max due p90 ${maxDueP90}, due p90 on day ${LAST_DAY} ${lastDueP90}`
      expect(maxDueP90, message).toBeLessThanOrEqual(40)
      expect(lastDueP90, message).toBeLessThanOrEqual(15)
    },
  )
})
