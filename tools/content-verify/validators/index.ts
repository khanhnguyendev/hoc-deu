/**
 * Executable validator checks for `compare: { kind: 'validator' }` (platform design §3.7). Live
 * outside `content/**` on purpose: a new validator is a normal code PR, so the bot cannot add
 * executable check code by opening a content PR.
 */
import { topologicalOrder } from './topological-order'

export type Validator = (
  input: Readonly<Record<string, unknown>>,
  actual: unknown,
  expected: unknown,
) => true | string

export const VALIDATORS: Readonly<Record<string, Validator>> = {
  'topological-order': topologicalOrder,
}
