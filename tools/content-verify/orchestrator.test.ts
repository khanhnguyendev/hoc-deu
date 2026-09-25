import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { discoverProblems, type ProblemUnderTest } from './discover'
import { verifyProblems, type Exec, type ExecResult } from './orchestrator'
import type { Sandbox, Spawn, ToolPaths } from './sandbox'

const FIXTURES = join(import.meta.dirname, '__fixtures__', 'tracks')
const TOOLS: ToolPaths = {
  python: '/t/python3',
  javac: '/t/javac',
  java: '/t/java',
  go: '/t/go',
  timeout: '/usr/bin/timeout',
  sudo: '/usr/bin/sudo',
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

/** The harness command inside a spawn, sandboxed or not: everything after the resolved tool. */
function innerCommand(spawn: Spawn): string[] {
  const all = [spawn.cmd, ...spawn.args]
  const start = all.findIndex((part) => part.startsWith('/t/') || part.endsWith('/bin'))
  return all.slice(start)
}

const isWarmUp = (spawn: Spawn): boolean => innerCommand(spawn).includes('warm-up')

const isCase = (spawn: Spawn): boolean => {
  const inner = innerCommand(spawn)
  if (isWarmUp(spawn)) return false
  return inner.includes('runner.py') || inner.includes('Main') || inner[0]!.endsWith('/bin')
}

let workRoot: string
beforeEach(() => {
  workRoot = mkdtempSync(join(tmpdir(), 'cv-orchestrator-'))
})
afterEach(() => {
  rmSync(workRoot, { recursive: true, force: true })
})

describe('verifyProblems — scheduling', () => {
  function tracker() {
    let running = 0
    let maxRunning = 0
    const events: string[] = []
    const exec: Exec = async (spawn) => {
      running += 1
      maxRunning = Math.max(maxRunning, running)
      events.push(isWarmUp(spawn) ? 'warm-up' : isCase(spawn) ? 'case' : 'build')
      await new Promise((resolve) => setTimeout(resolve, 2))
      running -= 1
      return ok('0')
    }
    return {
      exec,
      events,
      maxRunning: () => maxRunning,
    }
  }

  it('sandbox mode runs one unit at a time and kills stray processes after every case (fix 6)', async () => {
    const sandbox: Sandbox = { user: 'cvsandbox' }
    const track = tracker()
    const granted: string[] = []
    const problems = load(['demo:lc-9001', 'demo:lc-9004'])
    await verifyProblems(problems, {
      jobs: 4,
      workRoot,
      sandbox,
      tools: TOOLS,
      deps: {
        exec: track.exec,
        killSandboxProcesses: (target) => {
          expect(target).toEqual(sandbox)
          track.events.push('kill')
        },
        grantSandboxDir: (target, dir) => {
          expect(target).toEqual(sandbox)
          granted.push(dir)
        },
      },
    })
    expect(track.maxRunning()).toBe(1)
    track.events.forEach((event, index) => {
      if (event !== 'kill') expect(track.events[index + 1]).toBe('kill')
    })
    // 3 languages × 4 cases for lc-9001, plus its 3 builds, the Go warm-up and lc-9004's 3
    // compile-only checks
    expect(track.events.filter((event) => event === 'case')).toHaveLength(12)
    expect(track.events.filter((event) => event === 'warm-up')).toHaveLength(1)
    expect(track.events.filter((event) => event === 'kill')).toHaveLength(19)
    // every unit directory (and the shared Go caches) is handed to the sandbox user
    expect(granted.filter((dir) => dir.endsWith('-python'))).toHaveLength(2)
    expect(granted.some((dir) => dir.endsWith('go-cache'))).toBe(true)
  })

  it('local mode runs up to `jobs` units in parallel and never kills', async () => {
    const track = tracker()
    await verifyProblems(load(['demo:lc-9001', 'demo:lc-9006', 'demo:lc-9007']), {
      jobs: 3,
      workRoot,
      sandbox: null,
      tools: TOOLS,
      deps: {
        exec: track.exec,
        killSandboxProcesses: () => track.events.push('kill'),
        grantSandboxDir: () => {
          throw new Error('no sandbox: nothing to grant')
        },
      },
    })
    expect(track.maxRunning()).toBeGreaterThan(1)
    expect(track.maxRunning()).toBeLessThanOrEqual(3)
    expect(track.events).not.toContain('kill')
  })
})

describe('verifyProblems — results', () => {
  // Every run gets an empty work root of its own, as the CLI's mkdtemp does.
  const run = (problems: ProblemUnderTest[], exec: Exec) =>
    verifyProblems(problems, {
      jobs: 1,
      workRoot: mkdtempSync(join(workRoot, 'run-')),
      sandbox: null,
      tools: TOOLS,
      deps: { exec },
    })

  it('judges pass, fail, crash, invalid output and timeout per case', async () => {
    // lc-9001 sumList: example-1 → 6, example-2 → 5, empty → 0, negatives → -3
    const byIndex: Record<string, ExecResult> = {
      '0': ok('6', 120),
      '1': ok('7', 30),
      '2': {
        exitCode: 2,
        stdout: '',
        stderr: 'panic: boom\n\ngoroutine 1',
        ms: 5,
        timedOut: false,
      },
      '3': ok('not json', 5),
    }
    const [result] = await run(load(['demo:lc-9001'], 'go'), async (spawn) => {
      const inner = innerCommand(spawn)
      // the warm-up's outcome never counts
      if (isWarmUp(spawn)) return { exitCode: 2, stdout: '', stderr: 'no', ms: 1, timedOut: true }
      if (inner[0] === '/t/go') return ok()
      return byIndex[inner.at(-1)!]!
    })
    expect(result).toEqual({
      id: 'demo:lc-9001',
      kind: 'function',
      verification: 'tested',
      ok: false,
      languages: [
        {
          lang: 'go',
          status: 'failed',
          cases: [
            { name: 'example-1', status: 'pass', ms: 120 },
            { name: 'example-2', status: 'fail', ms: 30, detail: 'expected 5 got 7' },
            { name: 'empty', status: 'error', ms: 5, detail: 'crashed: panic: boom\ngoroutine 1' },
            { name: 'negatives', status: 'error', ms: 5, detail: 'invalid output: not json' },
          ],
        },
      ],
    })

    const [timedOut] = await run(load(['demo:lc-9001'], 'go'), async (spawn) =>
      innerCommand(spawn)[0] === '/t/go' || isWarmUp(spawn)
        ? ok()
        : { exitCode: null, stdout: '', stderr: '', ms: 2003, timedOut: true },
    )
    expect(timedOut?.languages[0]?.cases[0]).toEqual({
      name: 'example-1',
      status: 'timeout',
      ms: 2003,
      detail: 'timed out after 2000 ms',
    })
  })

  it('compares an in-place signature with the argument the runner prints', async () => {
    const [result] = await run(load(['demo:lc-9006'], 'go'), async (spawn) => {
      const inner = innerCommand(spawn)
      if (inner[0] === '/t/go' || isWarmUp(spawn)) return ok()
      return ok(['[3,2,1]', '[5,4]', '[]', '[9]'][Number(inner.at(-1))])
    })
    expect(result?.ok).toBe(true)
    expect(result?.languages[0]?.status).toBe('tested')
  })

  it('a compile failure fails the language with the first 20 lines of stderr and runs no case', async () => {
    const stderr = Array.from({ length: 30 }, (_, index) => `line ${index + 1}`).join('\n')
    const calls: string[][] = []
    const [result] = await run(load(['demo:lc-9005'], 'java'), async (spawn) => {
      calls.push(innerCommand(spawn))
      return { exitCode: 1, stdout: '', stderr, ms: 900, timedOut: false }
    })
    expect(calls).toHaveLength(1)
    expect(result?.languages[0]).toEqual({
      lang: 'java',
      status: 'failed',
      cases: [],
      detail: stderr.split('\n').slice(0, 20).join('\n'),
    })
    expect(result?.ok).toBe(false)
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
