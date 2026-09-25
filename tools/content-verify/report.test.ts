import { describe, expect, it } from 'vitest'
import type { CaseResult, LanguageResult, ProblemResult } from './orchestrator'
import { formatReport } from './report'

const passing = (count: number, msEach: number): CaseResult[] =>
  Array.from({ length: count }, (_, index) => ({
    name: `case-${index + 1}`,
    status: 'pass',
    ms: msEach,
  }))

const tested = (lang: LanguageResult['lang'], cases: CaseResult[]): LanguageResult => ({
  lang,
  status: cases.every((testCase) => testCase.status === 'pass') ? 'tested' : 'failed',
  cases,
})

const compileOnly = (lang: LanguageResult['lang']): LanguageResult => ({
  lang,
  status: 'compile-only',
  cases: [],
})

const RESULTS: ProblemResult[] = [
  {
    id: 'dsa:lc-0001',
    kind: 'function',
    verification: 'tested',
    ok: true,
    // 6 × 150 + 6 × 150 + 6 × 50/3 ≈ 1.9 s of case time
    languages: [
      tested('python', passing(6, 150)),
      tested('java', passing(6, 150)),
      tested('go', passing(6, 50 / 3)),
    ],
  },
  {
    id: 'dsa:lc-0155',
    kind: 'design-class',
    verification: 'compile-only',
    ok: true,
    languages: [compileOnly('python'), compileOnly('java'), compileOnly('go')],
  },
  {
    id: 'dsa:lc-0049',
    kind: 'function',
    verification: 'tested',
    ok: false,
    languages: [
      tested('python', passing(5, 100)),
      tested('java', passing(5, 100)),
      tested('go', [
        ...passing(4, 5),
        { name: 'anagram-groups', status: 'fail', ms: 200, detail: 'expected [["a"]] got []' },
      ]),
    ],
  },
]

const TOOLCHAINS = 'python 3.13.7 · javac 23.0.2 · go 1.26.5 · 1 job (sandbox cvsandbox)'

describe('formatReport', () => {
  it('prints one row per problem and the summary as the last line (§3.7)', () => {
    expect(formatReport(RESULTS, TOOLCHAINS)).toBe(
      [
        'content:verify · python 3.13.7 · javac 23.0.2 · go 1.26.5 · 1 job (sandbox cvsandbox)',
        '  dsa:lc-0001  tested        python 6/6 · java 6/6 · go 6/6       1.9 s',
        '  dsa:lc-0155  compile-only  python ✓ · java ✓ · go ✓  (design-class runs in M3c)',
        `  dsa:lc-0049  FAILED        go: case 'anagram-groups' expected [["a"]] got [] (0.2 s)`,
        'tested 1 · compile-only 1 · failed 1',
      ].join('\n'),
    )
  })

  it('names the phase that runs each unsupported kind', () => {
    const tree: ProblemResult = {
      id: 'dsa:lc-0104',
      kind: 'tree',
      verification: 'compile-only',
      ok: true,
      languages: [compileOnly('python')],
    }
    const report = formatReport([tree], TOOLCHAINS)
    expect(report).toContain('python ✓  (tree runs in M3b)')
  })

  it('shows a compile failure, a timeout and further failures on one row', () => {
    const result: ProblemResult = {
      id: 'demo:lc-9003',
      kind: 'function',
      verification: 'tested',
      ok: false,
      languages: [
        tested('python', [
          ...passing(3, 100),
          { name: 'empty-row', status: 'timeout', ms: 1004, detail: 'timed out after 1000 ms' },
        ]),
        {
          lang: 'java',
          status: 'failed',
          cases: [],
          detail: "Solution.java:6: error: ';' expected\n        double total = 0\n",
        },
        tested('go', [
          { name: 'a', status: 'error', ms: 12, detail: 'crashed: panic: boom\ngoroutine 1' },
          { name: 'b', status: 'fail', ms: 3, detail: 'expected 1 got 2' },
        ]),
      ],
    }
    expect(formatReport([result], TOOLCHAINS).split('\n')[1]).toBe(
      "  demo:lc-9003  FAILED        python: case 'empty-row' timed out after 1000 ms (1.0 s)" +
        " · java: Solution.java:6: error: ';' expected" +
        " · go: case 'a' crashed: panic: boom (0.0 s) (+1 more)",
    )
  })

  it('lists discovery errors before the summary and counts them', () => {
    const report = formatReport([], 'python 3.13.7 · 4 jobs (no sandbox)', [
      'content/tracks/dsa/problems/lc-0001-two-sum/tests.yaml: cases: needs at least 4 cases',
    ])
    expect(report.split('\n')).toEqual([
      'content:verify · python 3.13.7 · 4 jobs (no sandbox)',
      '  error  content/tracks/dsa/problems/lc-0001-two-sum/tests.yaml: cases: needs at least 4 cases',
      'tested 0 · compile-only 0 · failed 0 · errors 1',
    ])
  })

  it('reports nothing to verify with zero counts', () => {
    expect(formatReport([], 'python 3.13.7 · 4 jobs (no sandbox)')).toBe(
      [
        'content:verify · python 3.13.7 · 4 jobs (no sandbox)',
        'tested 0 · compile-only 0 · failed 0',
      ].join('\n'),
    )
  })
})
