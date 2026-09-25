/**
 * Simulated-finish lookup table (platform design §5.11, decision A; ADR-0015, ADR-0037): the
 * realistic-learner finish time for a track/roadmap variant at a given daily budget, linearly
 * interpolated between the table's budget rows and clamped at the ends. The table is
 * `projections.generated.json`, written by `pnpm sim:projections` from the TypeScript simulation
 * (`simulate.ts`, 200 realistic learners per row, 182-day runs) and keyed by the projection inputs
 * hash, which `tools/sim/projections.test.ts` checks against the content.
 */
import { z } from 'zod'
import generated from './projections.generated.json'

export type Projection = { medianWeeks: number; p90Weeks: number }

/** `[budget, medianWeeks, p90Weeks]`, one row per simulated daily budget (minutes). */
export type ProjectionRow = readonly [budget: number, median: number, p90: number]

/** Track → variant → rows, sorted by budget. */
export type ProjectionTable = Readonly<
  Record<string, Readonly<Record<string, readonly ProjectionRow[]>>>
>

const rowSchema = z.tuple([z.number().positive(), z.number().positive(), z.number().positive()])
const generatedSchema = z.object({
  table: z.record(z.string(), z.record(z.string(), z.array(rowSchema))),
})

/** The generated table (§5.11), validated when the module loads. */
export const PROJECTION_TABLE: ProjectionTable = generatedSchema.parse(generated).table

/** The table row pair `budgetMinutes` falls between, clamping to the first/last row at the ends. */
function bracket(
  rows: readonly ProjectionRow[],
  budgetMinutes: number,
): [ProjectionRow, ProjectionRow] | null {
  const first = rows[0]
  const last = rows[rows.length - 1]
  if (first === undefined || last === undefined) return null
  if (budgetMinutes <= first[0]) return [first, first]
  if (budgetMinutes >= last[0]) return [last, last]
  for (let i = 0; i < rows.length - 1; i += 1) {
    const lower = rows[i]
    const upper = rows[i + 1]
    if (lower === undefined || upper === undefined) continue
    if (budgetMinutes >= lower[0] && budgetMinutes <= upper[0]) return [lower, upper]
  }
  return [first, last]
}

const interpolate = (lower: number, upper: number, ratio: number) => lower + (upper - lower) * ratio

/**
 * The finish for `trackId`'s `variant` roadmap at `budgetMinutes`/day in `table`, interpolated
 * linearly between its rows and clamped at the ends — `null` when the track or variant has no
 * rows.
 */
export function projectFinishIn(
  table: ProjectionTable,
  trackId: string,
  variant: string,
  budgetMinutes: number,
): Projection | null {
  const rows = table[trackId]?.[variant]
  if (rows === undefined || rows.length === 0) return null

  const pair = bracket(rows, budgetMinutes)
  if (pair === null) return null
  const [lower, upper] = pair
  const ratio = upper[0] === lower[0] ? 0 : (budgetMinutes - lower[0]) / (upper[0] - lower[0])
  return {
    medianWeeks: interpolate(lower[1], upper[1], ratio),
    p90Weeks: interpolate(lower[2], upper[2], ratio),
  }
}

/**
 * The simulated realistic finish for `trackId`'s `variant` roadmap at `budgetMinutes`/day
 * (`PROJECTION_TABLE`) — `null` when the track or variant has no table (e.g. English, which has no
 * simulated projection).
 */
export function projectFinish(
  trackId: string,
  variant: string,
  budgetMinutes: number,
): Projection | null {
  return projectFinishIn(PROJECTION_TABLE, trackId, variant, budgetMinutes)
}
