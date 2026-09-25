import { describe, expect, it } from 'vitest'
import { main, type MainDeps } from './main'

/** Fake dependencies that record the order of the calls that matter. */
function fakes() {
  const calls: string[] = []
  const out: string[] = []
  const err: string[] = []
  const deps: MainDeps = {
    resolveToolchains: () => {
      calls.push('toolchains')
      return {
        tools: { python: '/t/python3', javac: '', java: '', go: '' },
        summary: 'python 3.13.7',
      }
    },
    discoverProblems: () => {
      calls.push('discover')
      return { problems: [], issues: [] }
    },
    verifyProblems: async () => {
      calls.push('verify')
      return []
    },
    makeWorkRoot: () => {
      calls.push('mkdtemp')
      return '/tmp/cv-fake'
    },
    removeWorkRoot: () => {
      calls.push('remove')
    },
    log: (line) => out.push(line),
    error: (line) => err.push(line),
  }
  return { calls, out, err, deps }
}

describe('content:verify main', () => {
  it('refuses to run unsandboxed on GitHub Actions before looking at anything (exit 2)', async () => {
    const { calls, err, deps } = fakes()
    expect(await main(['--root', '/nowhere'], { GITHUB_ACTIONS: 'true' }, deps)).toBe(2)
    expect(calls).toEqual([])
    expect(err.join('\n')).toMatch(/refusing to run solutions unsandboxed on GitHub Actions/)
  })

  it('checks the policy before parsing arguments', async () => {
    const { calls, err, deps } = fakes()
    expect(await main(['--nope'], { GITHUB_ACTIONS: 'true' }, deps)).toBe(2)
    expect(calls).toEqual([])
    expect(err.join('\n')).toMatch(/refusing/)
  })

  it('rejects bad arguments before resolving toolchains or discovering (exit 2)', async () => {
    const { calls, err, deps } = fakes()
    expect(await main(['--lang', 'rust'], {}, deps)).toBe(2)
    expect(calls).toEqual([])
    expect(err.join('\n')).toMatch(/--lang must be one of python, java, go/)
  })

  it('resolves toolchains, discovers, verifies in a work root it removes, and prints the report', async () => {
    const { calls, out, deps } = fakes()
    expect(await main(['--lang', 'python', '--jobs', '2'], {}, deps)).toBe(0)
    expect(calls).toEqual(['toolchains', 'discover', 'mkdtemp', 'verify', 'remove'])
    expect(out.join('\n')).toBe(
      'content:verify · python 3.13.7 · 2 jobs (no sandbox)\ntested 0 · compile-only 0 · failed 0',
    )
  })

  it('runs one job with a sandbox user', async () => {
    const { out, deps } = fakes()
    const env = { GITHUB_ACTIONS: 'true', CONTENT_VERIFY_SANDBOX_USER: 'cvsandbox' }
    expect(await main(['--jobs', '8'], env, deps)).toBe(0)
    expect(out.join('\n').split('\n')[0]).toBe(
      'content:verify · python 3.13.7 · 1 job (sandbox cvsandbox)',
    )
  })
})
