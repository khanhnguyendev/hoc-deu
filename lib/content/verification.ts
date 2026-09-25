/**
 * Verification status is derived from the signature kind (platform design §3.7, decision 21): a
 * problem is `tested` only while its signature kind has a runner; everything else falls back to
 * `compile-only` until that phase ships.
 */
import type { SignatureKind } from './schemas/tests'

export type Verification = 'tested' | 'compile-only'

/** M3a supports `function` only; M3b adds `linked-list` / `tree` / `graph-node` / `random-list`,
 * M3c adds `design-class`. */
export const SUPPORTED_SIGNATURE_KINDS: readonly SignatureKind[] = ['function']

export function verificationFor(kind: SignatureKind): Verification {
  return SUPPORTED_SIGNATURE_KINDS.includes(kind) ? 'tested' : 'compile-only'
}
