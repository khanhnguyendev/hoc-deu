/**
 * The compile-only fallback (platform design §3.7, decision 21): a signature kind without a runner
 * gets the syntax / compile checks plus a signature check. Every kind has a runner since M3c, so
 * this file pretends `design-class` has none (the mock below) to keep the fallback tested for the
 * next kind that arrives before its runner.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { discoverProblems, type ProblemUnderTest } from './discover'
import { verifyProblems, type Exec, type ExecResult } from './orchestrator'
import { goHarness } from './runners/go'
import { javaHarness } from './runners/java'
import { pythonHarness } from './runners/python'
import type { Spawn, ToolPaths } from './sandbox'

vi.mock('@/lib/content/verification', () => ({
  verificationFor: (kind: string) => (kind === 'design-class' ? 'compile-only' : 'tested'),
}))

const FIXTURES = join(import.meta.dirname, '__fixtures__', 'tracks')
const TOOLS: ToolPaths = { python: '/t/python3', javac: '/t/javac', java: '/t/java', go: '/t/go' }

const fixture = (id: string): ProblemUnderTest => {
  const problem = discoverProblems(FIXTURES, { ids: [id] }).problems[0]
  if (problem === undefined) throw new Error(`fixture ${id} missing`)
  return problem
}
const load = (ids: string[], lang?: 'python' | 'java' | 'go'): ProblemUnderTest[] =>
  discoverProblems(FIXTURES, { ids, ...(lang === undefined ? {} : { lang }) }).problems

const ok = (stdout = '', ms = 10): ExecResult => ({
  exitCode: 0,
  stdout,
  stderr: '',
  ms,
  timedOut: false,
})

/** The harness command inside a spawn: everything from the resolved tool on. */
function innerCommand(spawn: Spawn): string[] {
  const all = [spawn.cmd, ...spawn.args]
  return all.slice(all.findIndex((part) => part.startsWith('/t/')))
}

let root: string
let workDir: string
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'cv-compile-only-'))
  workDir = join(root, 'unit')
  mkdirSync(workDir)
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('compile-only harnesses', () => {
  it('python: checks a design class for every method (compile-only)', () => {
    const prepared = pythonHarness.prepare(fixture('demo:lc-9004'), workDir)
    expect(prepared.compileOnly[0]?.args.at(-1)).toBe(
      '{"className":"MinStack","methods":["push","pop","top","getMin"]}',
    )
    expect(prepared.signatureIssues).toEqual([])
  })

  it('java: compile-only compiles the solution alone and checks the class and methods', () => {
    const prepared = javaHarness.prepare(fixture('demo:lc-9004'), workDir)
    expect(prepared.compileOnly).toEqual([
      {
        cmd: 'javac',
        args: ['--release', '21', '-proc:none', '-encoding', 'UTF-8', '-d', 'out', 'Solution.java'],
        cwd: workDir,
        timeoutMs: 60_000,
      },
    ])
    expect(prepared.signatureIssues).toEqual([])
    expect(existsSync(join(workDir, 'HarnessMain.java'))).toBe(false)
  })

  it('java: a missing method declaration is a signature issue (a call does not count)', () => {
    const problem = fixture('demo:lc-9004')
    const dir = join(root, 'problem')
    mkdirSync(dir)
    writeFileSync(
      join(dir, 'Solution.java'),
      readFileSync(join(problem.dir, 'Solution.java'), 'utf8').replace(
        'public int getMin() {\n        return minimums.peek();\n    }',
        '',
      ) + '\nclass Other { void use(MinStack s) { s.getMin(); } }\n',
    )
    const prepared = javaHarness.prepare({ ...problem, dir }, workDir)
    expect(prepared.signatureIssues).toEqual(['Solution.java: no method getMin(…) { … }'])
  })

  it('go: compile-only adds a main stub, vets, and checks the type, Constructor and methods', () => {
    const prepared = goHarness.prepare(fixture('demo:lc-9004'), workDir)
    expect(readFileSync(join(workDir, 'main_stub.go'), 'utf8')).toBe(
      'package main\n\nfunc main() {\n\tvar harnessObject MinStack = Constructor()\n\t_ = harnessObject\n}\n',
    )
    expect(existsSync(join(workDir, 'main_harness.go'))).toBe(false)
    expect(prepared.compileOnly.map((command) => [command.cmd, ...command.args])).toEqual([
      ['go', 'vet', '.'],
    ])
    expect(prepared.compileOnly[0]?.env?.CGO_ENABLED).toBe('0')
    expect(prepared.signatureIssues).toEqual([])
  })

  it('go: reports a missing Constructor or method', () => {
    const problem = fixture('demo:lc-9004')
    const dir = join(root, 'problem')
    mkdirSync(dir)
    writeFileSync(
      join(dir, 'solution.go'),
      readFileSync(join(problem.dir, 'solution.go'), 'utf8')
        .replace('func Constructor()', 'func NewMinStack()')
        .replace('func (this *MinStack) GetMin()', 'func (this *MinStack) Minimum()'),
    )
    const prepared = goHarness.prepare({ ...problem, dir }, workDir)
    expect(prepared.signatureIssues).toEqual([
      'solution.go: no func Constructor(',
      'solution.go: no method (*MinStack) GetMin(',
    ])
  })

  it('compile-only: the main stub creates the class through Constructor (typed, zero arguments)', () => {
    {
      goHarness.prepare(fixture('demo:lc-9009'), workDir)
      expect(readFileSync(join(workDir, 'main_stub.go'), 'utf8')).toBe(
        'package main\n\nfunc main() {\n\tvar harnessObject Counter = Constructor(*new(int))\n\t_ = harnessObject\n}\n',
      )
    }
  })
})

describe('compile-only in the orchestrator', () => {
  const run = (problems: ProblemUnderTest[], exec: Exec) =>
    verifyProblems(problems, {
      jobs: 1,
      workRoot: mkdtempSync(join(root, 'run-')),
      sandbox: null,
      tools: TOOLS,
      deps: { exec },
    })

  it('an unsupported kind runs the compile-only checks', async () => {
    const calls: string[][] = []
    const results = await run(load(['demo:lc-9004']), async (spawn) => {
      calls.push(innerCommand(spawn))
      return ok()
    })
    expect(results).toEqual([
      {
        id: 'demo:lc-9004',
        kind: 'design-class',
        verification: 'compile-only',
        ok: true,
        languages: [
          { lang: 'python', status: 'compile-only', cases: [] },
          { lang: 'java', status: 'compile-only', cases: [] },
          { lang: 'go', status: 'compile-only', cases: [] },
        ],
      },
    ])
    expect(calls.map((call) => call.slice(0, 2))).toEqual([
      ['/t/python3', '-I'],
      ['/t/javac', '--release'],
      ['/t/go', 'vet'],
    ])
  })

  it('a failing compile-only check fails the language', async () => {
    const [result] = await run(load(['demo:lc-9004'], 'python'), async () => ({
      exitCode: 1,
      stdout: '{"ok": false}',
      stderr: 'class MinStack has no method getMin',
      ms: 40,
      timedOut: false,
    }))
    expect(result?.languages[0]).toEqual({
      lang: 'python',
      status: 'failed',
      cases: [],
      detail: 'class MinStack has no method getMin',
    })
  })
})
