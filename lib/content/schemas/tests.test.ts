import { describe, expect, it } from 'vitest'
import { parseValueType, testsFileSchema, testsMinimumIssues, valueMatches } from './tests'

const issueMessages = (result: ReturnType<typeof testsFileSchema.safeParse>): string[] => {
  if (result.success) return []
  return result.error.issues.map((issue) => issue.message)
}

const twoSum = {
  signature: {
    kind: 'function',
    name: 'twoSum',
    params: { nums: 'int[]', target: 'int' },
    returns: 'int[]',
  },
  compare: 'unordered',
  cases: [
    { name: 'example-1', input: { nums: [2, 7, 11, 15], target: 9 }, expected: [0, 1] },
    { name: 'example-2', input: { nums: [3, 2, 4], target: 6 }, expected: [1, 2] },
    { name: 'duplicates', input: { nums: [3, 3], target: 6 }, expected: [0, 1] },
    { name: 'negatives', input: { nums: [-1, -2, -3, -4, -5], target: -8 }, expected: [2, 4] },
  ],
  timeoutMs: 2000,
}

describe('testsFileSchema — the §3.5 two-sum file', () => {
  it('parses, normalising the compare shorthand and defaulting nothing else', () => {
    const result = testsFileSchema.safeParse(twoSum)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.compare).toEqual({ kind: 'unordered' })
    expect(result.data.timeoutMs).toBe(2000)
    expect(result.data.cases).toHaveLength(4)
  })

  it('defaults compare to exact and timeoutMs to 2000 when omitted', () => {
    const rest = { signature: twoSum.signature, cases: twoSum.cases }
    const result = testsFileSchema.safeParse(rest)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.compare).toEqual({ kind: 'exact' })
    expect(result.data.timeoutMs).toBe(2000)
  })
})

describe('§3.5 minimum (testsMinimumIssues)', () => {
  it('passes with 2 examples + 2 other cases', () => {
    expect(testsMinimumIssues(twoSum.cases)).toEqual([])
  })

  it('flags 3 cases as short of the 4-case minimum', () => {
    const issues = testsMinimumIssues(twoSum.cases.slice(0, 3))
    expect(issues).toContain('needs at least 4 cases in total')
  })

  it('flags no example-* case', () => {
    const cases = twoSum.cases.map((c) => ({ ...c, name: c.name.replace('example-', 'case-') }))
    expect(testsMinimumIssues(cases)).toContain('needs at least one case named example-<n>')
  })

  it('flags one edge case only (needs 2 besides the examples)', () => {
    const cases = [twoSum.cases[0], twoSum.cases[2]]
    expect(cases[0]).toBeDefined()
    const issues = testsMinimumIssues(cases as { name: string }[])
    expect(issues).toContain('needs at least 2 cases besides the LeetCode examples')
  })

  it('the schema surfaces the minimum issues on the cases path', () => {
    const result = testsFileSchema.safeParse({ ...twoSum, cases: twoSum.cases.slice(0, 3) })
    expect(result.success).toBe(false)
    expect(issueMessages(result)).toContain('needs at least 4 cases in total')
  })
})

describe('testsFileSchema — case-level rules', () => {
  it('rejects duplicate case names', () => {
    const result = testsFileSchema.safeParse({
      ...twoSum,
      cases: [...twoSum.cases, { ...twoSum.cases[3], name: 'example-1' }],
    })
    expect(result.success).toBe(false)
    expect(issueMessages(result).some((m) => m.includes('duplicate case name'))).toBe(true)
  })

  it('rejects a missing input key', () => {
    const cases = twoSum.cases.map((c, i) =>
      i === 0 ? { ...c, input: { nums: c.input.nums } } : c,
    )
    const result = testsFileSchema.safeParse({ ...twoSum, cases })
    expect(result.success).toBe(false)
    expect(issueMessages(result).some((m) => m.includes('missing input "target"'))).toBe(true)
  })

  it('rejects an extra input key', () => {
    const cases = twoSum.cases.map((c, i) =>
      i === 0 ? { ...c, input: { ...c.input, extra: 1 } } : c,
    )
    const result = testsFileSchema.safeParse({ ...twoSum, cases })
    expect(result.success).toBe(false)
    expect(issueMessages(result).some((m) => m.includes('unexpected input "extra"'))).toBe(true)
  })

  it('rejects an input value of the wrong type (nums: [1, "2"])', () => {
    const cases = twoSum.cases.map((c, i) =>
      i === 0 ? { ...c, input: { ...c.input, nums: [1, '2'] } } : c,
    )
    const result = testsFileSchema.safeParse({ ...twoSum, cases })
    expect(result.success).toBe(false)
    expect(
      issueMessages(result).some((m) =>
        m.includes('input "nums" does not match its declared type'),
      ),
    ).toBe(true)
  })

  it('rejects an expected value of the wrong type (expected: "x" for int[])', () => {
    const cases = twoSum.cases.map((c, i) => (i === 0 ? { ...c, expected: 'x' } : c))
    const result = testsFileSchema.safeParse({ ...twoSum, cases })
    expect(result.success).toBe(false)
    expect(issueMessages(result).some((m) => m.includes('expected does not match'))).toBe(true)
  })

  it('rejects an in-place arg that is not a parameter', () => {
    const result = testsFileSchema.safeParse({
      ...twoSum,
      compare: { kind: 'in-place', arg: 'missing' },
    })
    expect(result.success).toBe(false)
    expect(issueMessages(result).some((m) => m.includes('is not a parameter'))).toBe(true)
  })

  it('accepts an in-place compare against a real parameter', () => {
    const sortInPlace = {
      signature: {
        kind: 'function',
        name: 'sortInPlace',
        params: { nums: 'int[]' },
        returns: 'void',
      },
      compare: { kind: 'in-place', arg: 'nums' },
      cases: [
        { name: 'example-1', input: { nums: [3, 1, 2] }, expected: [1, 2, 3] },
        { name: 'example-2', input: { nums: [1] }, expected: [1] },
        { name: 'empty', input: { nums: [] }, expected: [] },
        { name: 'duplicates', input: { nums: [2, 2, 1] }, expected: [1, 2, 2] },
      ],
    }
    const result = testsFileSchema.safeParse(sortInPlace)
    expect(result.success).toBe(true)
  })
})

describe('testsFileSchema — design-class cases', () => {
  const encodeDecode = {
    signature: {
      kind: 'design-class',
      className: 'Codec',
      constructor: {},
      methods: {
        encode: { params: { strs: 'string[]' }, returns: 'string' },
        decode: { params: { s: 'string' }, returns: 'string[]' },
      },
    },
    compare: 'exact',
    cases: [
      {
        name: 'example-1',
        ops: ['Codec', 'encode', 'decode'],
        args: [[], [['a', 'b']], [{ $result: 1 }]],
        expected: [{ $any: true }, { $any: true }, ['a', 'b']],
      },
      {
        name: 'example-2',
        ops: ['Codec', 'encode', 'decode'],
        args: [[], [[]], [{ $result: 1 }]],
        expected: [{ $any: true }, { $any: true }, []],
      },
      {
        name: 'single',
        ops: ['Codec', 'encode', 'decode'],
        args: [[], [['x']], [{ $result: 1 }]],
        expected: [{ $any: true }, { $any: true }, ['x']],
      },
      {
        name: 'special-chars',
        ops: ['Codec', 'encode', 'decode'],
        args: [[], [['a/b', 'c']], [{ $result: 1 }]],
        expected: [{ $any: true }, { $any: true }, ['a/b', 'c']],
      },
    ],
  }

  it('accepts a valid codec round-trip with $result and $any', () => {
    const result = testsFileSchema.safeParse(encodeDecode)
    expect(result.success).toBe(true)
  })

  it('defaults an omitted constructor to no parameters (not the inherited Object.prototype.constructor)', () => {
    const signature = {
      kind: 'design-class',
      className: 'Codec',
      methods: encodeDecode.signature.methods,
    }
    const parsed = testsFileSchema.parse({ ...encodeDecode, signature })
    expect(parsed.signature).toMatchObject({ kind: 'design-class', constructor: {} })
  })

  it('still rejects a constructor that is not a parameter map', () => {
    const signature = { ...encodeDecode.signature, constructor: 'Codec()' }
    expect(testsFileSchema.safeParse({ ...encodeDecode, signature }).success).toBe(false)
  })

  it('rejects ops[0] !== className', () => {
    const cases = encodeDecode.cases.map((c, i) =>
      i === 0 ? { ...c, ops: ['NotCodec', 'encode', 'decode'] } : c,
    )
    const result = testsFileSchema.safeParse({ ...encodeDecode, cases })
    expect(result.success).toBe(false)
    expect(issueMessages(result).some((m) => m.includes('ops[0] must be the class name'))).toBe(
      true,
    )
  })

  it('rejects unequal ops/args/expected lengths', () => {
    const cases = encodeDecode.cases.map((c, i) =>
      i === 0 ? { ...c, args: c.args.slice(0, 2) } : c,
    )
    const result = testsFileSchema.safeParse({ ...encodeDecode, cases })
    expect(result.success).toBe(false)
    expect(issueMessages(result).some((m) => m.includes('same length'))).toBe(true)
  })

  it('rejects { $result: n } that does not refer to an earlier op (n >= its own index)', () => {
    const cases = encodeDecode.cases.map((c, i) =>
      i === 0 ? { ...c, args: [c.args[0], c.args[1], [{ $result: 3 }]] } : c,
    )
    const result = testsFileSchema.safeParse({ ...encodeDecode, cases })
    expect(result.success).toBe(false)
    expect(
      issueMessages(result).some((m) => m.includes('must refer to an earlier operation')),
    ).toBe(true)
  })

  it('rejects { $any: true } inside args', () => {
    const cases = encodeDecode.cases.map((c, i) =>
      i === 0 ? { ...c, args: [c.args[0], [{ $any: true }], c.args[2]] } : c,
    )
    const result = testsFileSchema.safeParse({ ...encodeDecode, cases })
    expect(result.success).toBe(false)
    expect(
      issueMessages(result).some((m) => m.includes('$any: true } is only allowed in expected')),
    ).toBe(true)
  })

  it('rejects a later op that is not a declared method', () => {
    const cases = encodeDecode.cases.map((c, i) =>
      i === 0 ? { ...c, ops: ['Codec', 'notAMethod', 'decode'] } : c,
    )
    const result = testsFileSchema.safeParse({ ...encodeDecode, cases })
    expect(result.success).toBe(false)
    expect(issueMessages(result).some((m) => m.includes('is not a method of'))).toBe(true)
  })
})

describe('parseValueType', () => {
  it.each([
    ['int', { base: 'int', dims: 0 }],
    ['char[][]', { base: 'char', dims: 2 }],
    ['int[][][]', null],
    ['List<int>', null],
    ['int[]', { base: 'int', dims: 1 }],
    ['unknown', null],
  ] as const)('%s → %j', (text, expected) => {
    expect(parseValueType(text)).toEqual(expected)
  })
})

describe('valueMatches', () => {
  it('char requires a one-code-unit string', () => {
    expect(valueMatches('a', { base: 'char', dims: 0 })).toBe(true)
    expect(valueMatches('ab', { base: 'char', dims: 0 })).toBe(false)
    expect(valueMatches('', { base: 'char', dims: 0 })).toBe(false)
  })

  it('long requires a safe integer', () => {
    expect(valueMatches(5, { base: 'long', dims: 0 })).toBe(true)
    expect(valueMatches(5.5, { base: 'long', dims: 0 })).toBe(false)
    expect(valueMatches(Number.MAX_SAFE_INTEGER + 10, { base: 'long', dims: 0 })).toBe(false)
  })

  it('checks arrays per dims', () => {
    expect(valueMatches([1, 2], { base: 'int', dims: 1 })).toBe(true)
    expect(valueMatches([1, '2'], { base: 'int', dims: 1 })).toBe(false)
    expect(valueMatches([[1, 2], [3]], { base: 'int', dims: 2 })).toBe(true)
    expect(valueMatches([1, 2], { base: 'int', dims: 2 })).toBe(false)
  })
})
