/** Small helpers shared by the `content:build` modules. */

/**
 * UTF-16 code-unit order, as `Array.prototype.sort` without a comparator: never locale-dependent,
 * so generated files, reports and issue lists are identical on every machine.
 */
export const compareNames = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

/** Records by their `id` (see `compareNames`). */
export const byId = <T extends { id: string }>(a: T, b: T): number => compareNames(a.id, b.id)

/** `1 week`, `2 weeks`, `0 issues`. */
export const count = (n: number, noun: string): string => `${n} ${noun}${n === 1 ? '' : 's'}`
