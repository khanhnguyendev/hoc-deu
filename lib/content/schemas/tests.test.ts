import { describe, expect, it } from 'vitest'
import {
  parseParamType,
  parseValueType,
  structureIssue,
  testsFileSchema,
  testsMinimumIssues,
  valueMatches,
} from './tests'

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

const issuesOf = (value: unknown) => {
  const result = testsFileSchema.safeParse(value)
  if (result.success) return []
  return result.error.issues.map((issue) => ({ path: issue.path, message: issue.message }))
}

/** A structured file with 4 cases whose `values` fill `head`/`root`/`node` and `expected`. */
function structured(
  kind: string,
  params: Record<string, string>,
  returns: string,
  cases: { input: Record<string, unknown>; expected: unknown }[],
  compare?: unknown,
) {
  const names = ['example-1', 'edge-a', 'edge-b', 'edge-c']
  return {
    signature: { kind, name: 'solve', params, returns },
    ...(compare === undefined ? {} : { compare }),
    cases: cases.map((testCase, index) => ({ name: names[index], ...testCase })),
  }
}

describe('parseParamType — the structured kinds (M3b)', () => {
  it.each([
    ['linked-list', 'ListNode', { kind: 'structure', structure: 'list' }],
    ['linked-list', 'ListNode[]', { kind: 'structure', structure: 'lists' }],
    ['tree', 'TreeNode', { kind: 'structure', structure: 'tree' }],
    ['graph-node', 'Node', { kind: 'structure', structure: 'graph' }],
    ['random-list', 'Node', { kind: 'structure', structure: 'random-list' }],
    ['tree', 'int', { kind: 'value', type: { base: 'int', dims: 0 } }],
    ['linked-list', 'int[][]', { kind: 'value', type: { base: 'int', dims: 2 } }],
    ['function', 'int[]', { kind: 'value', type: { base: 'int', dims: 1 } }],
    ['function', 'ListNode', null],
    ['linked-list', 'TreeNode', null],
    ['tree', 'ListNode', null],
    ['tree', 'Node', null],
    ['linked-list', 'Node', null],
    ['graph-node', 'ListNode[]', null],
    ['design-class', 'int', null],
  ] as const)('%s: %s → %j', (kind, text, expected) => {
    expect(parseParamType(kind, text)).toEqual(expected)
  })
})

describe('structureIssue — the LeetCode encodings', () => {
  it('list: an array of integers; { values, pos } only as an input', () => {
    expect(structureIssue('list', [1, 2, 3], 'input')).toBeNull()
    expect(structureIssue('list', [], 'input')).toBeNull()
    expect(structureIssue('list', { values: [3, 2, 0, -4], pos: 1 }, 'input')).toBeNull()
    expect(structureIssue('list', { values: [1], pos: -1 }, 'input')).toBeNull()
    expect(structureIssue('list', { values: [1, 2], pos: 2 }, 'input')).toBe(
      'pos must be -1 (no cycle) or the index of a node (0–1)',
    )
    expect(structureIssue('list', { values: [], pos: 0 }, 'input')).toBe(
      'pos must be -1 (no cycle) for an empty list',
    )
    expect(structureIssue('list', { values: [1], pos: 0, extra: 1 }, 'input')).toBe(
      'a linked list is an array of integers, or { values, pos } for a cycle',
    )
    expect(structureIssue('list', [1, null], 'input')).toBe(
      'a linked list is an array of integers, or { values, pos } for a cycle',
    )
    expect(structureIssue('list', { values: [1], pos: 0 }, 'expected')).toBe(
      'a returned linked list is an array of integers',
    )
  })

  it('lists: an array of list encodings', () => {
    expect(structureIssue('lists', [[1, 4], [], [2]], 'input')).toBeNull()
    expect(structureIssue('lists', [1, 2], 'input')).toBe(
      'ListNode[] is an array of linked lists (arrays of integers)',
    )
  })

  it('tree: level order with null gaps, a non-null root, no trailing nulls, no orphan values', () => {
    expect(structureIssue('tree', [3, 9, 20, null, null, 15, 7], 'input')).toBeNull()
    expect(structureIssue('tree', [], 'input')).toBeNull()
    expect(structureIssue('tree', [1, null, 2, null, 3], 'input')).toBeNull()
    expect(structureIssue('tree', [null], 'input')).toBe(
      'the root of a non-empty tree cannot be null ([] is the empty tree)',
    )
    expect(structureIssue('tree', [1, 2, null], 'expected')).toBe(
      "drop the trailing nulls (LeetCode's level-order form)",
    )
    expect(structureIssue('tree', [1, null, null, 4], 'input')).toBe(
      'value 3 has no parent: every null ends its branch',
    )
    expect(structureIssue('tree', [1, 'x'], 'input')).toBe(
      'a tree is a level-order array of integers and nulls',
    )
  })

  it('graph: node i + 1 at index i, neighbours in 1..n, no self-loop or repeat, connected', () => {
    expect(
      structureIssue(
        'graph',
        [
          [2, 4],
          [1, 3],
          [2, 4],
          [1, 3],
        ],
        'input',
      ),
    ).toBeNull()
    expect(structureIssue('graph', [[]], 'input')).toBeNull()
    expect(structureIssue('graph', [], 'input')).toBeNull()
    expect(structureIssue('graph', [[2], [3]], 'input')).toBe(
      'node 2 lists neighbour 3: neighbours are node numbers 1–2',
    )
    expect(structureIssue('graph', [[1]], 'input')).toBe('node 1 lists itself as a neighbour')
    expect(structureIssue('graph', [[2, 2], [1]], 'input')).toBe('node 1 lists neighbour 2 twice')
    expect(structureIssue('graph', [[2], [1], []], 'input')).toBe(
      'node 3 cannot be reached from node 1',
    )
    expect(structureIssue('graph', [1, 2], 'input')).toBe(
      'a graph is an adjacency list: node i + 1 at index i, an array of neighbour numbers',
    )
  })

  it('random-list: [[val, randomIndex | null], …]', () => {
    expect(
      structureIssue(
        'random-list',
        [
          [7, null],
          [13, 0],
        ],
        'input',
      ),
    ).toBeNull()
    expect(structureIssue('random-list', [], 'expected')).toBeNull()
    expect(structureIssue('random-list', [[1, 2]], 'input')).toBe(
      'node 0 has random index 2: random is null or a node index (0–0)',
    )
    expect(structureIssue('random-list', [[1]], 'input')).toBe(
      'a random-pointer list is [[val, randomIndex | null], …]',
    )
  })
})

describe('testsFileSchema — structured kinds (M3b)', () => {
  it('accepts a linked list in and out, a cycle input and a ListNode[] input', () => {
    expect(
      issuesOf(
        structured('linked-list', { head: 'ListNode' }, 'ListNode', [
          { input: { head: [1, 2] }, expected: [2, 1] },
          { input: { head: [] }, expected: [] },
          { input: { head: [1] }, expected: [1] },
          { input: { head: [1, 2, 3] }, expected: [3, 2, 1] },
        ]),
      ),
    ).toEqual([])
    expect(
      issuesOf(
        structured('linked-list', { head: 'ListNode' }, 'bool', [
          { input: { head: { values: [3, 2, 0, -4], pos: 1 } }, expected: true },
          { input: { head: { values: [1], pos: -1 } }, expected: false },
          { input: { head: [] }, expected: false },
          { input: { head: { values: [1], pos: 0 } }, expected: true },
        ]),
      ),
    ).toEqual([])
    expect(
      issuesOf(
        structured('linked-list', { lists: 'ListNode[]' }, 'ListNode', [
          {
            input: {
              lists: [
                [1, 4, 5],
                [1, 3, 4],
              ],
            },
            expected: [1, 1, 3, 4, 4, 5],
          },
          { input: { lists: [] }, expected: [] },
          { input: { lists: [[]] }, expected: [] },
          { input: { lists: [[2], [1]] }, expected: [1, 2] },
        ]),
      ),
    ).toEqual([])
  })

  it('a malformed encoding is an issue on the case path', () => {
    expect(
      issuesOf(
        structured('tree', { root: 'TreeNode', k: 'int' }, 'TreeNode', [
          { input: { root: [1, null, 2], k: 1 }, expected: [1, 2] },
          { input: { root: [null, 1], k: 1 }, expected: [] },
          { input: { root: [], k: 'x' }, expected: [] },
          { input: { root: [1], k: 1 }, expected: [1, null] },
        ]),
      ),
    ).toEqual([
      {
        path: ['cases', 1, 'input', 'root'],
        message:
          'input "root" is not a valid TreeNode: the root of a non-empty tree cannot be null ([] is the empty tree)',
      },
      {
        path: ['cases', 2, 'input', 'k'],
        message: 'input "k" does not match its declared type',
      },
      {
        path: ['cases', 3, 'expected'],
        message:
          "expected is not a valid TreeNode: drop the trailing nulls (LeetCode's level-order form)",
      },
    ])
  })

  it('a cycle is an input only: expected is a plain list', () => {
    expect(
      issuesOf(
        structured('linked-list', { head: 'ListNode' }, 'ListNode', [
          { input: { head: [1] }, expected: { values: [1], pos: 0 } },
          { input: { head: [] }, expected: [] },
          { input: { head: [2] }, expected: [2] },
          { input: { head: [3] }, expected: [3] },
        ]),
      ),
    ).toEqual([
      {
        path: ['cases', 0, 'expected'],
        message: 'expected is not a valid ListNode: a returned linked list is an array of integers',
      },
    ])
  })

  it('checks an in-place structure (143) against the argument type', () => {
    expect(
      issuesOf(
        structured(
          'linked-list',
          { head: 'ListNode' },
          'void',
          [
            { input: { head: [1, 2, 3, 4] }, expected: [1, 4, 2, 3] },
            { input: { head: [1] }, expected: [1] },
            { input: { head: [1, 2] }, expected: [1, 2] },
            { input: { head: [1, 2, 3] }, expected: 'x' },
          ],
          { kind: 'in-place', arg: 'head' },
        ),
      ),
    ).toEqual([
      {
        path: ['cases', 3, 'expected'],
        message: 'expected is not a valid ListNode: a returned linked list is an array of integers',
      },
    ])
  })

  it('rejects a type the kind does not know, on the signature path', () => {
    expect(
      issuesOf(
        structured('linked-list', { root: 'TreeNode' }, 'Node', [
          { input: { root: [1] }, expected: [1] },
          { input: { root: [1] }, expected: [1] },
          { input: { root: [1] }, expected: [1] },
          { input: { root: [1] }, expected: [1] },
        ]),
      ),
    ).toEqual([
      {
        path: ['signature', 'params', 'root'],
        message: 'not a linked-list type (ListNode, ListNode[] or a value type such as int[])',
      },
      {
        path: ['signature', 'returns'],
        message: 'not a linked-list type (ListNode, ListNode[] or a value type such as int[])',
      },
    ])
  })

  it('checks inputs by name for the structured kinds too', () => {
    expect(
      issuesOf(
        structured('graph-node', { node: 'Node' }, 'Node', [
          { input: { node: [[2], [1]] }, expected: [[2], [1]] },
          { input: {}, expected: [] },
          { input: { node: [], extra: 1 }, expected: [] },
          { input: { node: [[3], [1]] }, expected: [[]] },
        ]),
      ),
    ).toEqual([
      { path: ['cases', 1, 'input'], message: 'missing input "node"' },
      { path: ['cases', 2, 'input', 'extra'], message: 'unexpected input "extra"' },
      {
        path: ['cases', 3, 'input', 'node'],
        message:
          'input "node" is not a valid Node: node 1 lists neighbour 3: neighbours are node numbers 1–2',
      },
    ])
  })

  it('a random-pointer list round trip parses', () => {
    expect(
      issuesOf(
        structured('random-list', { head: 'Node' }, 'Node', [
          {
            input: {
              head: [
                [7, null],
                [13, 0],
              ],
            },
            expected: [
              [7, null],
              [13, 0],
            ],
          },
          { input: { head: [] }, expected: [] },
          { input: { head: [[1, 0]] }, expected: [[1, 0]] },
          { input: { head: [[1, 5]] }, expected: [[1, 0]] },
        ]),
      ),
    ).toEqual([
      {
        path: ['cases', 3, 'input', 'head'],
        message:
          'input "head" is not a valid Node: node 0 has random index 5: random is null or a node index (0–0)',
      },
    ])
  })
})

describe('testsFileSchema — design-class values (M3c)', () => {
  const minStack = (cases: unknown[], extra: Record<string, unknown> = {}) => ({
    signature: {
      kind: 'design-class',
      className: 'MinStack',
      methods: {
        push: { params: { val: 'int' }, returns: 'void' },
        pop: { returns: 'void' },
        top: { returns: 'int' },
        getMin: { returns: 'int' },
      },
    },
    ...extra,
    cases: [
      ...cases,
      ...['example-1', 'edge-a', 'edge-b', 'edge-c'].slice(cases.length).map((name) => ({
        name,
        ops: ['MinStack', 'push', 'getMin'],
        args: [[], [1], []],
        expected: [null, null, 1],
      })),
    ].map((testCase, index) => ({
      ...(testCase as object),
      name: index === 0 ? 'example-1' : `edge-${index}`,
    })),
  })
  const withCase = (testCase: Record<string, unknown>, extra?: Record<string, unknown>) =>
    minStack([{ name: 'example-1', ...testCase }], extra)
  const at = (value: unknown) => issuesOf(value).map((issue) => [issue.path, issue.message])

  it('accepts the fixture shape (void → null, the constructor → null or $any)', () => {
    expect(at(minStack([]))).toEqual([])
    expect(
      at(
        withCase({
          ops: ['MinStack', 'push', 'top'],
          args: [[], [3], []],
          expected: [{ $any: true }, null, { $any: true }],
        }),
      ),
    ).toEqual([])
  })

  it('checks each argument against the parameter type', () => {
    expect(
      at(withCase({ ops: ['MinStack', 'push'], args: [[], ['3']], expected: [null, null] })),
    ).toEqual([[['cases', 0, 'args', 1, 0], 'argument "val" does not match its declared type']])
  })

  it('checks constructor arguments against the constructor parameters', () => {
    const value = withCase({ ops: ['MinStack', 'top'], args: [[1.5], []], expected: [null, 1] })
    value.signature = { ...value.signature, constructor: { capacity: 'int' } } as never
    expect(at(value).filter(([path]) => (path as unknown[])[1] === 0)).toEqual([
      [['cases', 0, 'args', 0, 0], 'argument "capacity" does not match its declared type'],
    ])
  })

  it('checks expected against the return type; void methods and the constructor expect null', () => {
    expect(
      at(
        withCase({
          ops: ['MinStack', 'push', 'top'],
          args: [[], [3], []],
          expected: [1, 0, 'three'],
        }),
      ),
    ).toEqual([
      [['cases', 0, 'expected', 0], 'the constructor returns nothing: expected null'],
      [['cases', 0, 'expected', 1], '"push" returns void: expected null'],
      [['cases', 0, 'expected', 2], 'expected does not match the return type of "top"'],
    ])
  })

  it('{ $any: true } and { $result } must be whole values', () => {
    const codec = {
      signature: {
        kind: 'design-class',
        className: 'Codec',
        methods: {
          encode: { params: { strs: 'string[]' }, returns: 'string' },
          decode: { params: { s: 'string' }, returns: 'string[]' },
        },
      },
      cases: ['example-1', 'edge-a', 'edge-b', 'edge-c'].map((name, index) => ({
        name,
        ops: ['Codec', 'encode', 'decode'],
        args:
          index === 0
            ? [[], [[{ $result: 0 }]], [{ $result: 1 }]]
            : [[], [['a']], [{ $result: 1 }]],
        expected:
          index === 0
            ? [null, { $any: true }, ['a', { $any: true }]]
            : [null, { $any: true }, ['a']],
      })),
    }
    expect(at(codec)).toEqual([
      [['cases', 0, 'args', 1, 0], '{ $result: n } must be a whole argument'],
      [['cases', 0, 'expected', 2], '{ $any: true } must be a whole expected value'],
    ])
  })

  it('{ $result: n } must name a method whose return type is the parameter type', () => {
    const codec = {
      signature: {
        kind: 'design-class',
        className: 'Codec',
        methods: {
          encode: { params: { strs: 'string[]' }, returns: 'string' },
          decode: { params: { s: 'string' }, returns: 'string[]' },
          reset: { returns: 'void' },
        },
      },
      cases: ['example-1', 'edge-a', 'edge-b', 'edge-c'].map((name, index) => ({
        name,
        ops: ['Codec', 'encode', 'reset', 'decode', 'decode', 'decode'],
        args: [
          [],
          [['a']],
          [],
          [{ $result: index === 0 ? 3 : 1 }],
          [{ $result: 2 }],
          [{ $result: 0 }],
        ],
        expected: [null, { $any: true }, null, { $any: true }, { $any: true }, { $any: true }],
      })),
    }
    const issues = at(codec)
    expect(issues).toContainEqual([
      ['cases', 0, 'args', 3, 0],
      '{ $result: 3 } must refer to an earlier operation',
    ])
    expect(issues).toContainEqual([
      ['cases', 1, 'args', 4, 0],
      '{ $result: 2 } refers to "reset", which returns void',
    ])
    expect(issues).toContainEqual([
      ['cases', 1, 'args', 5, 0],
      '{ $result: 0 } refers to the constructor, which returns nothing',
    ])
  })

  it('{ $result: n } of another type is refused (decode(decode(…)))', () => {
    const codec = {
      signature: {
        kind: 'design-class',
        className: 'Codec',
        methods: {
          encode: { params: { strs: 'string[]' }, returns: 'string' },
          decode: { params: { s: 'string' }, returns: 'string[]' },
        },
      },
      cases: ['example-1', 'edge-a', 'edge-b', 'edge-c'].map((name, index) => ({
        name,
        ops: ['Codec', 'encode', 'decode', 'encode'],
        args: [[], [['a']], [{ $result: 1 }], [{ $result: index === 0 ? 1 : 2 }]],
        expected: [null, { $any: true }, ['a'], { $any: true }],
      })),
    }
    expect(at(codec)).toEqual([
      [
        ['cases', 0, 'args', 3, 0],
        '{ $result: 1 } is a string ("encode"), but "strs" is a string[]',
      ],
    ])
  })

  it('one signature per method name: names that differ only in the first letter are refused (Go exports Push for push)', () => {
    const value = minStack([])
    value.signature = {
      ...value.signature,
      methods: { ...value.signature.methods, Push: { params: { val: 'int' }, returns: 'void' } },
    } as never
    expect(at(value)).toEqual([
      [
        ['signature', 'methods', 'Push'],
        '"Push" and "push" are one method in Go (Push): one name, one signature',
      ],
    ])
  })

  it('a design class compares each result with exact, unordered, unordered-nested or float', () => {
    expect(at(minStack([], { compare: 'unordered' }))).toEqual([])
    expect(at(minStack([], { compare: { kind: 'float', tolerance: 0.001 } }))).toEqual([])
    expect(at(minStack([], { compare: { kind: 'validator', name: 'topological-order' } }))).toEqual(
      [
        [
          ['compare'],
          'a design class compares each result: exact, unordered, unordered-nested or float',
        ],
      ],
    )
    expect(at(minStack([], { compare: { kind: 'in-place', arg: 'val' } }))).toEqual([
      [
        ['compare'],
        'a design class compares each result: exact, unordered, unordered-nested or float',
      ],
    ])
  })
})
