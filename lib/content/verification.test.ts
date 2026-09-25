import { describe, expect, it } from 'vitest'
import { SIGNATURE_KINDS, type SignatureKind } from './schemas/tests'
import { SUPPORTED_SIGNATURE_KINDS, verificationFor } from './verification'

describe('verificationFor', () => {
  it('function is tested', () => {
    expect(verificationFor('function')).toBe('tested')
  })

  it.each(SIGNATURE_KINDS.filter((kind) => kind !== 'function'))(
    '%s is compile-only (M3a)',
    (kind: SignatureKind) => {
      expect(verificationFor(kind)).toBe('compile-only')
    },
  )

  it('SUPPORTED_SIGNATURE_KINDS is exactly [function] in M3a', () => {
    expect(SUPPORTED_SIGNATURE_KINDS).toEqual(['function'])
  })
})
