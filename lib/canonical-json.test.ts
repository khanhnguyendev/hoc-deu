import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { bodyHash, canonicalJson } from './canonical-json'

describe('canonicalJson (decision 10: sorted keys, no whitespace)', () => {
  it('sorts object keys at every depth and drops whitespace', () => {
    expect(canonicalJson({ b: 1, a: { d: [3, { z: 1, y: 2 }], c: null } })).toBe(
      '{"a":{"c":null,"d":[3,{"y":2,"z":1}]},"b":1}',
    )
  })

  it('keeps array order, and serialises strings, numbers and booleans as JSON does', () => {
    expect(canonicalJson([2, 1, 'é\n"', true, false, 1.5, -0])).toBe(
      '[2,1,"é\\n\\"",true,false,1.5,0]',
    )
  })

  it('leaves out undefined properties, as JSON.stringify does', () => {
    expect(canonicalJson({ a: undefined, b: 1 })).toBe('{"b":1}')
  })

  it('sorts keys by code unit, never by locale', () => {
    expect(canonicalJson({ b: 1, B: 2, á: 3, a: 4 })).toBe('{"B":2,"a":4,"b":1,"á":3}')
  })
})

describe('canonicalJson — hostile keys', () => {
  it('hashes a "__proto__" key as data, never as the prototype', () => {
    const parsed = JSON.parse('{"b":1,"__proto__":{"x":1}}') as unknown
    expect(canonicalJson(parsed)).toBe('{"__proto__":{"x":1},"b":1}')
    expect(bodyHash(parsed)).not.toBe(bodyHash({ b: 1 }))
  })
})

describe('bodyHash', () => {
  it('is the SHA-256 hex of the canonical JSON', () => {
    const expected = createHash('sha256').update('{"a":1,"b":[2,1]}', 'utf8').digest('hex')
    expect(bodyHash({ b: [2, 1], a: 1 })).toBe(expected)
  })

  it('key order never changes the hash; array order does', () => {
    expect(bodyHash({ a: 1, b: { c: 2, d: 3 } })).toBe(bodyHash({ b: { d: 3, c: 2 }, a: 1 }))
    expect(bodyHash({ a: [1, 2] })).not.toBe(bodyHash({ a: [2, 1] }))
    expect(bodyHash({ a: 1 })).toMatch(/^[0-9a-f]{64}$/)
  })
})
