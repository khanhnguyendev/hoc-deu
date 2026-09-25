import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { discoverProblems } from './discover'

const FIXTURES = join(import.meta.dirname, '__fixtures__', 'tracks')

describe('discoverProblems — fixtures', () => {
  it('finds the seven demo problems, sorted by ID, with every solution language present', () => {
    const { problems, issues } = discoverProblems(FIXTURES)
    expect(issues).toEqual([])
    expect(problems.map((problem) => problem.id)).toEqual([
      'demo:lc-9001',
      'demo:lc-9002',
      'demo:lc-9003',
      'demo:lc-9004',
      'demo:lc-9005',
      'demo:lc-9006',
      'demo:lc-9007',
    ])
    for (const problem of problems) {
      expect(problem.languages).toEqual(['python', 'java', 'go'])
    }
    const [first] = problems
    expect(first?.dir).toBe(join(FIXTURES, 'demo', 'problems', 'lc-9001-sum-pass'))
    expect(first?.tests.signature).toEqual({
      kind: 'function',
      name: 'sumList',
      params: { nums: 'int[]' },
      returns: 'int',
    })
    expect(first?.tests.timeoutMs).toBe(2000)
  })

  it('filters by problem ID and by language', () => {
    const { problems, issues } = discoverProblems(FIXTURES, {
      ids: ['demo:lc-9004', 'demo:lc-9006'],
      lang: 'go',
    })
    expect(issues).toEqual([])
    expect(problems.map((problem) => [problem.id, problem.languages])).toEqual([
      ['demo:lc-9004', ['go']],
      ['demo:lc-9006', ['go']],
    ])
  })

  it('reports an unknown problem ID', () => {
    const { problems, issues } = discoverProblems(FIXTURES, { ids: ['demo:lc-9999'] })
    expect(problems).toEqual([])
    expect(issues).toEqual(['--problem demo:lc-9999: no such problem with a tests.yaml'])
  })
})

describe('discoverProblems — edge cases', () => {
  let root: string | undefined

  afterEach(() => {
    if (root !== undefined) rmSync(root, { recursive: true, force: true })
    root = undefined
  })

  const writeProblem = (folder: string, files: Record<string, string>): void => {
    root ??= mkdtempSync(join(tmpdir(), 'cv-discover-'))
    const dir = join(root, 'dsa', 'problems', folder)
    mkdirSync(dir, { recursive: true })
    for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text)
  }

  const VALID_TESTS = `
signature: { kind: function, name: f, params: { n: int }, returns: int }
cases:
  - { name: example-1, input: { n: 1 }, expected: 1 }
  - { name: example-2, input: { n: 2 }, expected: 2 }
  - { name: zero, input: { n: 0 }, expected: 0 }
  - { name: negative, input: { n: -1 }, expected: -1 }
`

  it('lists only the solution files that exist', () => {
    writeProblem('lc-0007-reverse-integer', { 'tests.yaml': VALID_TESTS, 'solution.py': '' })
    const { problems, issues } = discoverProblems(root!)
    expect(issues).toEqual([])
    expect(problems.map((problem) => [problem.id, problem.languages])).toEqual([
      ['dsa:lc-0007', ['python']],
    ])
  })

  it('reports an invalid tests.yaml, a missing solution and a bad folder name', () => {
    writeProblem('lc-0001-two-sum', { 'tests.yaml': 'signature: 1\n', 'solution.py': '' })
    writeProblem('lc-0002-add-two-numbers', { 'tests.yaml': VALID_TESTS })
    writeProblem('two-sum', { 'tests.yaml': VALID_TESTS, 'solution.py': '' })
    writeProblem('lc-0003-yaml', { 'tests.yaml': 'cases: [\n', 'solution.py': '' })
    const { problems, issues } = discoverProblems(root!)
    expect(problems).toEqual([])
    expect(issues).toHaveLength(4)
    expect(issues[0]).toMatch(/lc-0001-two-sum\/tests\.yaml: signature: /)
    expect(issues[1]).toMatch(/lc-0002-add-two-numbers: tests\.yaml without a solution file/)
    expect(issues[2]).toMatch(/lc-0003-yaml\/tests\.yaml:2:1: /)
    expect(issues[3]).toMatch(/two-sum: not a problem folder/)
  })

  it('parses tests.yaml like content:build: YAML 1.2 core, no directives, anchors or custom tags (M4)', () => {
    // Under `%YAML 1.1` the key `n` reads as `false` (unpinned, the cases lost their input).
    writeProblem('lc-0021-merge-two-sorted-lists', {
      'tests.yaml': `%YAML 1.1\n---\n${VALID_TESTS}`,
      'solution.py': '',
    })
    writeProblem('lc-0022-generate-parentheses', {
      'tests.yaml': VALID_TESTS.replace(
        'input: { n: 1 }, expected: 1 }',
        'input: &one { n: 1 }, expected: 1 }',
      ).replace('input: { n: 2 }', 'input: *one'),
      'solution.py': '',
    })
    writeProblem('lc-0023-merge-k-sorted-lists', {
      'tests.yaml': VALID_TESTS.replace('expected: 0 }', 'expected: !!int 0 }').replace(
        'name: zero',
        'name: !custom zero',
      ),
      'solution.py': '',
    })
    const { problems, issues } = discoverProblems(root!)
    expect(problems).toEqual([])
    expect(issues).toEqual([
      expect.stringMatching(
        /lc-0021-merge-two-sorted-lists\/tests\.yaml:1:1: YAML directives \(%YAML, %TAG\) are not allowed/,
      ),
      expect.stringMatching(
        /lc-0022-generate-parentheses\/tests\.yaml:\d+:\d+: YAML anchors \(&\) and aliases \(\*\) are not allowed/,
      ),
      expect.stringMatching(
        /lc-0023-merge-k-sorted-lists\/tests\.yaml:\d+:\d+: the YAML tag !custom is not allowed/,
      ),
    ])
  })

  it('never reads through a symlink: solution, tests.yaml, problem folder or problems dir', () => {
    writeProblem('lc-0011-container-with-most-water', { 'tests.yaml': VALID_TESTS })
    writeProblem('lc-0012-integer-to-roman', { 'solution.py': '' })
    const outside = join(root!, 'outside')
    mkdirSync(outside)
    writeFileSync(join(outside, 'secret'), 'not content')
    const dsa = join(root!, 'dsa', 'problems')
    const target = join(outside, 'secret')
    symlinkSync(target, join(dsa, 'lc-0011-container-with-most-water', 'solution.go'))
    symlinkSync(target, join(dsa, 'lc-0012-integer-to-roman', 'tests.yaml'))
    symlinkSync(
      join(dsa, 'lc-0011-container-with-most-water'),
      join(dsa, 'lc-0013-roman-to-integer'),
    )
    mkdirSync(join(root!, 'english'))
    symlinkSync(dsa, join(root!, 'english', 'problems'))

    const { problems, issues } = discoverProblems(root!)
    expect(problems).toEqual([])
    expect(issues).toHaveLength(4)
    for (const pattern of [
      /lc-0011-container-with-most-water\/solution\.go: not a regular file \(a symlink\?\); never followed$/,
      /lc-0012-integer-to-roman\/tests\.yaml: not a regular file/,
      /lc-0013-roman-to-integer: not a regular directory \(a symlink\?\)/,
      /english\/problems: not a regular directory \(a symlink\?\)/,
    ]) {
      expect(
        issues.filter((issue) => pattern.test(issue)),
        String(pattern),
      ).toHaveLength(1)
    }
  })

  it('treats a missing root as nothing to verify', () => {
    expect(discoverProblems(join(tmpdir(), 'cv-does-not-exist'))).toEqual({
      problems: [],
      issues: [],
    })
  })
})
