/** SRS outcomes (platform design §5.7) and the result names that map to them (§4.4). */

export const OUTCOMES = ['success', 'partial', 'fail'] as const
export type Outcome = (typeof OUTCOMES)[number]

/**
 * Every `item.result` result name → its outcome. The item-type cores in `lib/content` carry the
 * same mapping per type; `lib/content/plan-catalog.test.ts` (task 4.10) keeps them equal.
 */
export const RESULT_OUTCOMES = {
  solved: 'success',
  hint: 'partial',
  failed: 'fail',
  know: 'success',
  unsure: 'partial',
  dont_know: 'fail',
} as const satisfies Record<string, Outcome>

export type ResultName = keyof typeof RESULT_OUTCOMES
