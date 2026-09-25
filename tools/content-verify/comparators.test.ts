import { describe, expect, it } from 'vitest'
import type { CompareSpec } from '@/lib/content/schemas/tests'
import { compare } from './comparators'

const noInput = {}

describe('exact', () => {
  const spec: CompareSpec = { kind: 'exact' }

  it('fails when order differs', () => {
    expect(compare(spec, [0, 1], [1, 0], noInput)).toEqual({
      ok: false,
      reason: expect.any(String),
    })
  })

  it('passes when equal', () => {
    expect(compare(spec, [1, 0], [1, 0], noInput)).toEqual({ ok: true })
  })

  it('1 equals 1.0 (both parse to the JS number 1)', () => {
    expect(compare(spec, 1, 1.0, noInput)).toEqual({ ok: true })
  })
})

describe('unordered', () => {
  const spec: CompareSpec = { kind: 'unordered' }

  it('passes regardless of order', () => {
    expect(compare(spec, [1, 0], [0, 1], noInput)).toEqual({ ok: true })
  })

  it('fails when the multiset differs ([1,1] vs [1,0])', () => {
    expect(compare(spec, [1, 1], [1, 0], noInput).ok).toBe(false)
  })
})

describe('unordered-nested', () => {
  const spec: CompareSpec = { kind: 'unordered-nested' }
  const groups = [['eat', 'tea', 'ate'], ['tan', 'nat'], ['bat']]
  const orderB = [['bat'], ['nat', 'tan'], ['ate', 'eat', 'tea']]
  const orderC = [['tan', 'nat'], ['bat'], ['tea', 'ate', 'eat']]

  it('passes for group-anagrams outputs in three different orders', () => {
    expect(compare(spec, groups, groups, noInput)).toEqual({ ok: true })
    expect(compare(spec, orderB, groups, noInput)).toEqual({ ok: true })
    expect(compare(spec, orderC, groups, noInput)).toEqual({ ok: true })
  })

  it('fails when a group is missing', () => {
    const missing = [
      ['eat', 'tea', 'ate'],
      ['tan', 'nat'],
    ]
    expect(compare(spec, missing, groups, noInput).ok).toBe(false)
  })
})

describe('float', () => {
  it('passes at the tolerance boundary (1e-5)', () => {
    const spec: CompareSpec = { kind: 'float', tolerance: 1e-5 }
    expect(compare(spec, 1e-5, 0, noInput)).toEqual({ ok: true })
  })

  it('fails just past the tolerance (2e-5)', () => {
    const spec: CompareSpec = { kind: 'float', tolerance: 1e-5 }
    expect(compare(spec, 2e-5, 0, noInput).ok).toBe(false)
  })
})

describe('in-place', () => {
  it('delegates to the nested compare (unordered)', () => {
    const spec: CompareSpec = { kind: 'in-place', arg: 'nums', compare: 'unordered' }
    expect(compare(spec, [2, 1], [1, 2], noInput)).toEqual({ ok: true })
    expect(compare(spec, [2, 1], [1, 1], noInput).ok).toBe(false)
  })
})

describe('validator', () => {
  const input = {
    numCourses: 4,
    prerequisites: [
      [1, 0],
      [2, 0],
      [3, 1],
      [3, 2],
    ],
  }
  const spec: CompareSpec = { kind: 'validator', name: 'topological-order' }

  it('passes a valid topological order', () => {
    expect(compare(spec, [0, 1, 2, 3], [0, 1, 2, 3], input)).toEqual({ ok: true })
  })

  it('fails an invalid order', () => {
    expect(compare(spec, [1, 0, 2, 3], [0, 1, 2, 3], input).ok).toBe(false)
  })

  it('fails for an unknown validator name', () => {
    const result = compare({ kind: 'validator', name: 'no-such-validator' }, [], [], noInput)
    expect(result).toEqual({ ok: false, reason: expect.stringContaining('unknown validator') })
  })
})
