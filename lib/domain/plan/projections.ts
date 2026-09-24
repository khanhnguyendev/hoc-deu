/**
 * Simulated-finish lookup table (platform design §5.11, decision A): the realistic-learner
 * finish time for a track/roadmap variant at a given daily budget, linearly interpolated between
 * the table's budget rows and clamped at the ends. This prototype table (182-day runs) is
 * replaced in M4 by `lib/domain/plan/projections.generated.json`, regenerated from the
 * TypeScript simulation and committed with its projection-inputs hash.
 */

export type Projection = { medianWeeks: number; p90Weeks: number }

/** `[budget, medianWeeks, p90Weeks]`, one row per simulated daily budget (minutes). */
type ProjectionRow = readonly [budget: number, median: number, p90: number]

export const PROJECTION_TABLE: Readonly<
  Record<string, Readonly<Record<string, readonly ProjectionRow[]>>>
> = {
  dsa: {
    '8w': [
      [45, 16.7, 18.1],
      [60, 11.6, 12.4],
      [75, 9.3, 9.7],
      [90, 7.3, 7.7],
      [120, 5.6, 6.1],
    ],
    '10w': [
      [45, 22.6, 24.1],
      [60, 16.5, 17.4],
      [75, 12.7, 13.6],
      [90, 10.3, 11.1],
      [120, 7.7, 8.4],
    ],
  },
}

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
 * The simulated realistic finish for `trackId`'s `variant` roadmap at `budgetMinutes`/day,
 * interpolated linearly between the table's rows and clamped at the ends — `null` when the
 * track or variant has no table (e.g. English, which has no simulated projection).
 */
export function projectFinish(
  trackId: string,
  variant: string,
  budgetMinutes: number,
): Projection | null {
  const rows = PROJECTION_TABLE[trackId]?.[variant]
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
