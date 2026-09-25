/** §5.7: streak, and the dates a schedule change skips (§5.9, decision 23, RF-1). */
import {
  addDays,
  daysBetween,
  localDay,
  type LocalDay,
  type ScheduleVersion,
} from '../time/localDay'

/**
 * Dates no local day ever had because a schedule change jumped over them (§5.9 moving east): for
 * consecutive versions (by `effectiveAt`) A → B at instant t, every date strictly between
 * `localDay(t − 1 ms, A)` and `localDay(t, B)`. Moving west never skips a date (the gap is ≤ 0);
 * identical consecutive versions skip nothing (the gap is always 0 or 1).
 */
export function scheduleSkippedDays(versions: readonly ScheduleVersion[]): Set<LocalDay> {
  const sorted = [...versions].sort(
    (a, b) => new Date(a.effectiveAt).getTime() - new Date(b.effectiveAt).getTime(),
  )
  const skipped = new Set<LocalDay>()
  for (let i = 1; i < sorted.length; i += 1) {
    const previous = sorted[i - 1]
    const current = sorted[i]
    if (previous === undefined || current === undefined) continue
    const changeMs = new Date(current.effectiveAt).getTime()
    const before = localDay(new Date(changeMs - 1), previous)
    const after = localDay(new Date(changeMs), current)
    const gap = daysBetween(before, after)
    for (let step = 1; step < gap; step += 1) {
      skipped.add(addDays(before, step))
    }
  }
  return skipped
}

/**
 * §5.7: consecutive completed days ending today — or yesterday when today is not completed yet; a
 * date in `skippedDays` is passed over without counting or breaking.
 */
export function streak(input: {
  readonly completedDays: ReadonlySet<LocalDay>
  readonly today: LocalDay
  readonly skippedDays?: ReadonlySet<LocalDay>
}): number {
  const { completedDays, today, skippedDays } = input
  const skipped = skippedDays ?? new Set<LocalDay>()
  let day = completedDays.has(today) ? today : addDays(today, -1)
  let count = 0
  for (;;) {
    if (completedDays.has(day)) {
      count += 1
      day = addDays(day, -1)
    } else if (skipped.has(day)) {
      day = addDays(day, -1)
    } else {
      break
    }
  }
  return count
}
