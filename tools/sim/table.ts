/**
 * One row of the simulated-finish table (platform design §5.11): realistic learners (seeds
 * 0…runs − 1) on a DSA variant at a daily budget, their finish in weeks as median and p90. A run
 * that does not finish within `days` is rerun for `rerunDays`; one that still does not finish is
 * reported, never given a made-up finish (the UI must never show "~99 tuần").
 */
import {
  SIM_START_DATE,
  simCatalog,
  simEnrollment,
  type SimInputs,
} from '@/lib/domain/plan/simInputs'
import { percentile, simulate } from '@/lib/domain/plan/simulate'

/** `[budget, medianWeeks, p90Weeks]` (`lib/domain/plan/projections.ts`). */
export type TableRow = readonly [budget: number, median: number, p90: number]

export type RowOptions = {
  readonly runs: number
  readonly days: number
  readonly rerunDays: number
}

export type RowResult = {
  /** Null when a run did not finish within `rerunDays`. */
  readonly row: TableRow | null
  /** Runs that needed `rerunDays`. */
  readonly reruns: number
  /** Seeds that did not finish within `rerunDays`. */
  readonly unfinished: readonly number[]
}

/** Weeks = (finishDay + 1) / 7, in calendar weeks from day 0. */
export function projectionRow(
  inputs: SimInputs,
  variant: string,
  budgetMinutes: number,
  { runs, days, rerunDays }: RowOptions,
): RowResult {
  const catalog = simCatalog(inputs)
  const enrollment = simEnrollment(inputs, variant, budgetMinutes)
  const finishDay = (seed: number, length: number): number | null =>
    simulate({
      catalog,
      enrollment,
      profile: 'realistic',
      seed,
      days: length,
      startDate: SIM_START_DATE,
    }).finishDay

  const weeks: number[] = []
  const unfinished: number[] = []
  let reruns = 0
  for (let seed = 0; seed < runs; seed += 1) {
    let finish = finishDay(seed, days)
    if (finish === null) {
      reruns += 1
      finish = finishDay(seed, rerunDays)
    }
    if (finish === null) unfinished.push(seed)
    else weeks.push((finish + 1) / 7)
  }

  const row: TableRow | null =
    unfinished.length > 0 ? null : [budgetMinutes, percentile(weeks, 0.5), percentile(weeks, 0.9)]
  return { row, reruns, unfinished }
}
