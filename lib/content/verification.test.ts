import { describe, expect, it } from 'vitest'
import { SIGNATURE_KINDS, type SignatureKind } from './schemas/tests'
import { SUPPORTED_SIGNATURE_KINDS, verificationFor } from './verification'

const M3B: SignatureKind[] = ['linked-list', 'tree', 'graph-node', 'random-list']

describe('verificationFor', () => {
  it.each(['function', ...M3B] as SignatureKind[])('%s is tested (M3a, M3b)', (kind) => {
    expect(verificationFor(kind)).toBe('tested')
  })

  it('design-class is compile-only until M3c', () => {
    expect(verificationFor('design-class')).toBe('compile-only')
  })

  it('SUPPORTED_SIGNATURE_KINDS is every kind but design-class in M3b', () => {
    expect(SUPPORTED_SIGNATURE_KINDS).toEqual(['function', ...M3B])
    expect(SIGNATURE_KINDS.filter((kind) => !SUPPORTED_SIGNATURE_KINDS.includes(kind))).toEqual([
      'design-class',
    ])
  })
})
