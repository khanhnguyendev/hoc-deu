/** §5.5: the new-item throttle. */
import type { ThrottleRule } from '../catalog'

/**
 * The `newPerDay` of the matching rule with the highest `dueAbove` that `dueCount` exceeds;
 * otherwise `newPerDay` (null = no cap). Rules may be given in any order.
 */
export function effectiveNewPerDay(
  newPerDay: number | null,
  throttle: readonly ThrottleRule[],
  dueCount: number,
): number | null {
  let effective = newPerDay
  let matchedAbove = -Infinity
  for (const rule of throttle) {
    if (dueCount > rule.dueAbove && rule.dueAbove > matchedAbove) {
      matchedAbove = rule.dueAbove
      effective = rule.newPerDay
    }
  }
  return effective
}
