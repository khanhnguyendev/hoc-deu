/**
 * Runs the real toolchains (Python ≥ 3.11, JDK ≥ 21, Go ≥ 1.22) on the fixtures, so it is opt-in:
 * `CONTENT_VERIFY_INTEGRATION=1 pnpm vitest run tools/content-verify/integration.test.ts`. The
 * content-verify workflow runs it with the sandbox user as the harness self-test (fix 6).
 */
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { availableParallelism, tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CODE_LANGUAGES } from '@/lib/content/schemas/common'
import { discoverProblems } from './discover'
import { verifyProblems, type ProblemResult } from './orchestrator'
import {
  assertSandboxPolicy,
  childEnv,
  removeWorkRoot,
  workRootParent,
  type Sandbox,
} from './sandbox'
import { resolveToolchains } from './toolchains'

const ENABLED = process.env.CONTENT_VERIFY_INTEGRATION === '1'
const FIXTURES = join(import.meta.dirname, '__fixtures__', 'tracks')
const RUNNERS = join(import.meta.dirname, 'runners')

type Summary = Record<
  string,
  {
    verification: string
    ok: boolean
    languages: Record<string, { status: string; failing: string[] }>
  }
>

function summarize(results: readonly ProblemResult[]): Summary {
  return Object.fromEntries(
    results.map((result) => [
      result.id,
      {
        verification: result.verification,
        ok: result.ok,
        languages: Object.fromEntries(
          result.languages.map((language) => [
            language.lang,
            {
              status: language.status,
              failing: language.cases
                .filter((testCase) => testCase.status !== 'pass')
                .map((testCase) => testCase.name),
            },
          ]),
        ),
      },
    ]),
  )
}

// The static-file checks run the toolchains as the runner, so they come first: nothing the runner
// executes may run after sandboxed code has had a chance to touch the machine (fix round 1).
describe.runIf(ENABLED)('static runner files (real toolchains)', () => {
  let dir: string
  let tools: ReturnType<typeof resolveToolchains>['tools']

  beforeAll(() => {
    tools = resolveToolchains(CODE_LANGUAGES, null).tools
    // RUNNER_TEMP in CI: the runner's own files stay out of the /tmp the sandbox user shares.
    dir = mkdtempSync(join(process.env.RUNNER_TEMP ?? tmpdir(), 'cv-static-'))
  })

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  const run = (cmd: string, args: string[], cwd: string, input?: string) => {
    const result = spawnSync(cmd, args, {
      cwd,
      input,
      encoding: 'utf8',
      timeout: 120_000,
      env: childEnv({
        PATH: process.env.PATH ?? '',
        HOME: process.env.HOME ?? '',
        CGO_ENABLED: '0',
        GOFLAGS: '-mod=mod -buildvcs=false',
        GOPROXY: 'off',
        GOTOOLCHAIN: 'local',
      }),
    })
    return { code: result.status, stdout: result.stdout, stderr: result.stderr }
  }

  it('normalize.go: nil slices at any depth → [], bytes → strings, NaN/Inf → null', () => {
    const goDir = mkdtempSync(join(dir, 'go-'))
    copyFileSync(join(RUNNERS, 'go', 'normalize.go'), join(goDir, 'normalize.go'))
    writeFileSync(join(goDir, 'go.mod'), 'module probe\n\ngo 1.22\n')
    writeFileSync(
      join(goDir, 'main.go'),
      `package main

import (
	"encoding/json"
	"math"
	"os"
)

func main() {
	values := []any{
		[][]int{nil, {1}},
		[]int(nil),
		byte('a'),
		[]byte("ab"),
		[][]byte{[]byte("x"), nil},
		math.NaN(),
		[]float64{1.5, math.Inf(1)},
		"text",
		true,
		nil,
		int64(7),
	}
	out, err := json.Marshal(harnessNormalize(values))
	if err != nil {
		panic(err)
	}
	os.Stdout.Write(out)
}
`,
    )
    const build = run(tools.go, ['build', '-o', 'probe', '.'], goDir)
    expect(build.stderr).toBe('')
    const probe = run(join(goDir, 'probe'), [], goDir)
    expect(JSON.parse(probe.stdout)).toEqual([
      [[], [1]],
      [],
      'a',
      ['a', 'b'],
      [['x'], []],
      null,
      [1.5, null],
      'text',
      true,
      null,
      7,
    ])
  }, 180_000)

  it('HarnessJson.java: strings, chars, arrays, iterables, boxed numbers, NaN → null', () => {
    const javaDir = mkdtempSync(join(dir, 'java-'))
    copyFileSync(join(RUNNERS, 'java', 'HarnessJson.java'), join(javaDir, 'HarnessJson.java'))
    writeFileSync(
      join(javaDir, 'Probe.java'),
      `import java.util.*;

public class Probe {
    public static void main(String[] args) {
        System.out.print(HarnessJson.write(new Object[] {
            "q\\"b\\\\s\\n\\t\\u0001é😀", 'c', new char[] {'x', 'y'}, new int[][] {{1}, {}},
            List.of(1, 2), Double.NaN, 2.5, 3.0, 10L, true, null, new boolean[] {false},
            Arrays.asList(List.of("a"), new ArrayList<String>()), Double.NEGATIVE_INFINITY,
            new long[] {9007199254740991L}, 1.0e-7
        }));
    }
}
`,
    )
    const compile = run(
      tools.javac,
      [
        '--release',
        '21',
        '-proc:none',
        '-encoding',
        'UTF-8',
        '-d',
        'out',
        'HarnessJson.java',
        'Probe.java',
      ],
      javaDir,
    )
    expect(compile.stderr).toBe('')
    const probe = run(tools.java, ['-cp', 'out', 'Probe'], javaDir)
    expect(probe.stdout).toMatch(/^[\x20-\x7e]*$/) // pure ASCII: non-ASCII text is \u-escaped
    expect(JSON.parse(probe.stdout)).toEqual([
      'q"b\\s\n\t\u0001é😀',
      'c',
      ['x', 'y'],
      [[1], []],
      [1, 2],
      null,
      2.5,
      3,
      10,
      true,
      null,
      [false],
      [['a'], []],
      null,
      [9007199254740991],
      1e-7,
    ])
  }, 180_000)

  it('runner.py: keeps print() off stdout, reports the in-place argument, NaN → null, crashes on stderr', () => {
    const pyDir = mkdtempSync(join(dir, 'py-'))
    copyFileSync(join(RUNNERS, 'python', 'runner.py'), join(pyDir, 'runner.py'))
    writeFileSync(
      join(pyDir, 'solution.py'),
      `class Solution:
    def noisy(self, nums):
        print("debug output")
        nums.append(float("nan"))
        return [1.5, float("inf"), "é"]

    def crash(self, n):
        return n // 0

    def deep(self, n):
        return 0 if n == 0 else 1 + self.deep(n - 1)
`,
    )
    const request = (method: string, args: unknown[], output: number | null) =>
      JSON.stringify({ file: 'solution.py', method, args, output })
    const returned = run(
      tools.python,
      ['-I', '-B', 'runner.py'],
      pyDir,
      request('noisy', [[1]], null),
    )
    expect(returned.code).toBe(0)
    expect(JSON.parse(returned.stdout)).toEqual([1.5, null, 'é'])
    expect(returned.stderr).toContain('debug output')

    const inPlace = run(tools.python, ['-I', '-B', 'runner.py'], pyDir, request('noisy', [[1]], 0))
    expect(JSON.parse(inPlace.stdout)).toEqual([1, null])

    const crashed = run(tools.python, ['-I', '-B', 'runner.py'], pyDir, request('crash', [1], null))
    expect(crashed.code).toBe(1)
    expect(crashed.stdout).toBe('')
    expect(crashed.stderr.split('\n')[0]).toMatch(/^ZeroDivisionError: /)

    const deep = run(tools.python, ['-I', '-B', 'runner.py'], pyDir, request('deep', [5000], null))
    expect(deep.stdout).toBe('5000')
  }, 60_000)

  it('check.py: a syntax error and a missing method fail with a reason on stderr', () => {
    const pyDir = mkdtempSync(join(dir, 'check-'))
    copyFileSync(join(RUNNERS, 'python', 'check.py'), join(pyDir, 'check.py'))
    writeFileSync(join(pyDir, 'good.py'), 'class MinStack:\n    def push(self, v): pass\n')
    writeFileSync(join(pyDir, 'bad.py'), 'class Solution:\n    def f(self)\n        return 1\n')
    const check = (file: string, className: string, methods: string[]) =>
      run(
        tools.python,
        ['-I', '-B', 'check.py', file, JSON.stringify({ className, methods })],
        pyDir,
      )

    const good = check('good.py', 'MinStack', ['push'])
    expect(good.code).toBe(0)
    expect(JSON.parse(good.stdout)).toEqual({ ok: true, reason: null })

    const missing = check('good.py', 'MinStack', ['push', 'getMin'])
    expect(missing.code).toBe(1)
    expect(missing.stderr.trim()).toBe('good.py: class MinStack has no method getMin')

    const syntax = check('bad.py', 'Solution', ['f'])
    expect(syntax.code).toBe(1)
    expect(syntax.stderr).toMatch(/^bad\.py:2: SyntaxError: /)
  }, 60_000)
})

describe.runIf(ENABLED)('content-verify on the fixtures (real toolchains)', () => {
  let sandbox: Sandbox = null
  let workRoot: string | undefined
  let results: ProblemResult[] = []
  const byId = (id: string): ProblemResult => {
    const result = results.find((candidate) => candidate.id === id)
    if (result === undefined) throw new Error(`no result for ${id}`)
    return result
  }
  const language = (id: string, lang: string) => {
    const result = byId(id).languages.find((candidate) => candidate.lang === lang)
    if (result === undefined) throw new Error(`no ${lang} result for ${id}`)
    return result
  }

  beforeAll(async () => {
    sandbox = assertSandboxPolicy(process.env)
    const { tools } = resolveToolchains(CODE_LANGUAGES, sandbox)
    workRoot = mkdtempSync(join(workRootParent(sandbox), 'cv-integration-'))
    const { problems, issues } = discoverProblems(FIXTURES)
    expect(issues).toEqual([])
    results = await verifyProblems(problems, {
      jobs: Math.max(1, Math.floor(availableParallelism() / 2)),
      workRoot,
      sandbox,
      tools,
    })
  }, 600_000)

  afterAll(() => {
    if (workRoot !== undefined) removeWorkRoot(sandbox, workRoot)
  })

  it('matches expected.json', () => {
    const expected: unknown = JSON.parse(
      readFileSync(join(import.meta.dirname, '__fixtures__', 'expected.json'), 'utf8'),
    )
    expect(summarize(results)).toEqual(expected)
  })

  it('function signatures pass in all three languages, the Go nil slice included (fix 8)', () => {
    for (const id of ['demo:lc-9001', 'demo:lc-9006', 'demo:lc-9007']) {
      expect(byId(id).languages.map((result) => result.status)).toEqual([
        'tested',
        'tested',
        'tested',
      ])
    }
  })

  it('reports the Python infinite loop as a timeout within timeoutMs + 1.5 s', () => {
    const loop = language('demo:lc-9003', 'python').cases.find((c) => c.name === 'empty-row')
    expect(loop?.status).toBe('timeout')
    expect(loop?.ms).toBeGreaterThanOrEqual(1000)
    expect(loop?.ms).toBeLessThanOrEqual(1000 + 1500)
  })

  it('names the failing Go case with expected and actual values', () => {
    const failing = language('demo:lc-9002', 'go').cases.find((c) => c.status !== 'pass')
    expect(failing).toMatchObject({
      name: 'with-empty-word',
      status: 'fail',
      detail: 'expected [["",""],["a"]] got [["a"]]',
    })
  })

  it('fails the Java compile error with a stderr excerpt', () => {
    const java = language('demo:lc-9005', 'java')
    expect(java.status).toBe('failed')
    expect(java.detail).toMatch(/Solution\.java:\d+: error: ';' expected/)
  })

  it('runs an unsupported kind compile-only, the signature check passing', () => {
    expect(byId('demo:lc-9004')).toMatchObject({ verification: 'compile-only', ok: true })
  })
})
