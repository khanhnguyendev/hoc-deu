import { describe, expect, it } from 'vitest'
import { SIGNATURE_KINDS, type SignatureKind } from './schemas/tests'
import { SUPPORTED_SIGNATURE_KINDS, verificationFor } from './verification'

const M3B: SignatureKind[] = ['linked-list', 'tree', 'graph-node', 'random-list']

describe('verificationFor', () => {
  it.each(['function', ...M3B] as SignatureKind[])('%s is tested (M3a, M3b)', (kind) => {
    expect(verificationFor(kind)).toBe('tested')
  })

  it('design-class is tested from M3c on', () => {
    expect(verificationFor('design-class')).toBe('tested')
  })

  it('SUPPORTED_SIGNATURE_KINDS is every kind in M3c', () => {
    expect(SUPPORTED_SIGNATURE_KINDS).toEqual([...SIGNATURE_KINDS])
  })
})
