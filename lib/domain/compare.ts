/**
 * The engine's two record helpers (M4 final review M-11): one comparator for deterministic
 * tie-breaks and one own-key lookup, instead of a copy per module.
 */

/** Code-unit order of two IDs (deterministic tie-breaks, Part B-M4 decision 29). */
export function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** `record[key]` for an own key only, so an ID such as `constructor` finds nothing. */
export function own<T>(record: Readonly<Record<string, T>>, key: string): T | undefined {
  return Object.hasOwn(record, key) ? record[key] : undefined
}
