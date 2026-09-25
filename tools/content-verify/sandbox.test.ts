import { describe, expect, it } from 'vitest'
import {
  assertSandboxPolicy,
  grantSandboxDir,
  killSandboxProcesses,
  removeWorkRoot,
  SANDBOX_BINARIES,
  SANDBOX_LIMITS,
  trustIssues,
  wrapCommand,
  type Command,
  type RunSync,
  type StatLike,
  type ToolPaths,
} from './sandbox'

const tools: ToolPaths = {
  python: '/opt/py/bin/python3',
  javac: '/opt/jdk/bin/javac',
  java: '/opt/jdk/bin/java',
  go: '/opt/go/bin/go',
}

const runCommand: Command = {
  cmd: '/opt/py/bin/python3',
  args: ['-I', '-B', 'runner.py'],
  cwd: '/tmp/cv/demo_lc-9001-python',
  stdin: '{"file":"solution.py"}',
  timeoutMs: 1500,
}

const compileCommand: Command = {
  cmd: '/opt/go/bin/go',
  args: ['build', '-o', 'bin', '.'],
  cwd: '/tmp/cv/demo_lc-9001-go',
  env: { CGO_ENABLED: '0', GOPROXY: 'off' },
  timeoutMs: 120_000,
}

const sandbox = { user: 'cvsandbox' }

describe('SANDBOX_BINARIES', () => {
  it('pins every privileged or post-sandbox command to a root-owned absolute path, never PATH', () => {
    expect(SANDBOX_BINARIES).toEqual({
      sudo: '/usr/bin/sudo',
      timeout: '/usr/bin/timeout',
      prlimit: '/usr/bin/prlimit',
      env: '/usr/bin/env',
      pkill: '/usr/bin/pkill',
      pgrep: '/usr/bin/pgrep',
      chown: '/usr/bin/chown',
      rm: '/usr/bin/rm',
    })
  })

  it('caps processes, file size and core dumps with room for javac and go build', () => {
    expect(SANDBOX_LIMITS).toEqual(['--nproc=512', '--fsize=268435456', '--core=0'])
  })
})

describe('wrapCommand — no sandbox', () => {
  it('keeps the command and passes only PATH, HOME and the command env', () => {
    const spawn = wrapCommand(compileCommand, null, tools)
    expect(spawn.cmd).toBe('/opt/go/bin/go')
    expect(spawn.args).toEqual(['build', '-o', 'bin', '.'])
    expect(Object.keys(spawn.env).sort()).toEqual(['CGO_ENABLED', 'GOPROXY', 'HOME', 'PATH'])
    expect(spawn.env.PATH).toBe(process.env.PATH)
    expect(spawn.env.CGO_ENABLED).toBe('0')
  })
})

describe('wrapCommand — sandbox', () => {
  const prefix = ['-n', '-u', 'cvsandbox', '--', '/usr/bin/timeout', '--kill-after=1']
  const limits = ['/usr/bin/prlimit', '--nproc=512', '--fsize=268435456', '--core=0', '--']
  const cleared = ['/usr/bin/env', '-i', 'PATH=/opt/py/bin:/opt/jdk/bin:/opt/go/bin', 'HOME=/tmp']

  it('runs a case as the sandbox user under timeout and prlimit with a cleared environment', () => {
    expect(wrapCommand(runCommand, sandbox, tools)).toEqual({
      cmd: '/usr/bin/sudo',
      args: [
        ...prefix,
        '3s',
        ...limits,
        ...cleared,
        '/opt/py/bin/python3',
        '-I',
        '-B',
        'runner.py',
      ],
      env: {},
    })
  })

  it('wraps a compile command the same way (fix 6), passing its env through env -i', () => {
    expect(wrapCommand(compileCommand, sandbox, tools)).toEqual({
      cmd: '/usr/bin/sudo',
      args: [
        ...prefix,
        '121s',
        ...limits,
        ...cleared,
        'CGO_ENABLED=0',
        'GOPROXY=off',
        '/opt/go/bin/go',
        'build',
        '-o',
        'bin',
        '.',
      ],
      env: {},
    })
  })

  it('refuses a command that is not an absolute path', () => {
    expect(() => wrapCommand({ ...runCommand, cmd: 'python3' }, sandbox, tools)).toThrow(/absolute/)
  })
})

/** A fake `spawnSync`: records every call, answers from `respond`. */
function recorder(respond: (cmd: string, args: readonly string[]) => number) {
  const calls: string[][] = []
  const run: RunSync = (cmd, args) => {
    calls.push([cmd, ...args])
    return { status: respond(cmd, args), stderr: '' }
  }
  return { calls, run }
}

describe('killSandboxProcesses', () => {
  it('does nothing without a sandbox', () => {
    const { calls, run } = recorder(() => 0)
    killSandboxProcesses(null, run)
    expect(calls).toEqual([])
  })

  it('kills by effective and real user until pgrep finds nothing (fix 6)', () => {
    let rounds = 0
    const { calls, run } = recorder((cmd, args) => {
      if (cmd === '/usr/bin/pgrep') return rounds >= 2 ? 1 : 0
      if (args.includes('-U')) rounds += 1
      return 0
    })
    killSandboxProcesses(sandbox, run)
    expect(calls.slice(0, 4)).toEqual([
      ['/usr/bin/sudo', '-n', '/usr/bin/pkill', '-KILL', '-u', 'cvsandbox'],
      ['/usr/bin/sudo', '-n', '/usr/bin/pkill', '-KILL', '-U', 'cvsandbox'],
      ['/usr/bin/pgrep', '-u', 'cvsandbox'],
      ['/usr/bin/pgrep', '-U', 'cvsandbox'],
    ])
    expect(calls.filter(([cmd]) => cmd === '/usr/bin/sudo')).toHaveLength(4)
    expect(calls.at(-1)).toEqual(['/usr/bin/pgrep', '-U', 'cvsandbox'])
  })

  it('fails closed when a process survives every round', () => {
    const { run } = recorder((cmd) => (cmd === '/usr/bin/pgrep' ? 0 : 1))
    expect(() => killSandboxProcesses(sandbox, run, { rounds: 3, pauseMs: 1 })).toThrow(
      /cvsandbox still has processes/,
    )
  })

  it('fails closed when pgrep itself fails', () => {
    const { run } = recorder((cmd) => (cmd === '/usr/bin/pgrep' ? 3 : 0))
    expect(() => killSandboxProcesses(sandbox, run)).toThrow(/pgrep/)
  })
})

describe('grantSandboxDir / removeWorkRoot', () => {
  it('chowns a unit directory recursively without following symlinks', () => {
    const { calls, run } = recorder(() => 0)
    grantSandboxDir(sandbox, '/tmp/cv/unit', { recursive: true }, run)
    expect(calls).toEqual([
      ['/usr/bin/sudo', '-n', '/usr/bin/chown', '-R', '-P', '--', 'cvsandbox', '/tmp/cv/unit'],
    ])
  })

  it('chowns a shared directory itself only', () => {
    const { calls, run } = recorder(() => 0)
    grantSandboxDir(sandbox, '/tmp/cv/go-cache', { recursive: false }, run)
    expect(calls).toEqual([
      ['/usr/bin/sudo', '-n', '/usr/bin/chown', '-h', '--', 'cvsandbox', '/tmp/cv/go-cache'],
    ])
  })

  it('throws when chown fails', () => {
    const { run } = recorder(() => 1)
    expect(() => grantSandboxDir(sandbox, '/tmp/cv/unit', { recursive: true }, run)).toThrow(
      /chown/,
    )
  })

  it('removes a sandbox work root with the trusted rm as root', () => {
    const { calls, run } = recorder(() => 0)
    removeWorkRoot(sandbox, '/tmp/content-verify-abc', run)
    expect(calls).toEqual([
      ['/usr/bin/sudo', '-n', '/usr/bin/rm', '-rf', '--', '/tmp/content-verify-abc'],
    ])
  })
})

describe('trustIssues', () => {
  const entry = (uid: number, mode: number, kind: 'dir' | 'file' | 'link' = 'dir'): StatLike => ({
    uid,
    mode,
    isFile: () => kind === 'file',
    isDirectory: () => kind === 'dir',
    isSymbolicLink: () => kind === 'link',
  })
  const fs = (entries: Record<string, StatLike>, links: Record<string, string> = {}) => ({
    lstat: (path: string): StatLike => {
      const found = entries[path]
      if (found === undefined) throw new Error(`ENOENT ${path}`)
      return found
    },
    realpath: (path: string): string => links[path] ?? path,
  })
  const system = {
    '/': entry(0, 0o40755),
    '/usr': entry(0, 0o40755),
    '/usr/bin': entry(0, 0o40755),
    '/usr/bin/sudo': entry(0, 0o104755, 'file'),
  }

  it('accepts a root-owned binary in root-owned directories nobody else can write', () => {
    expect(trustIssues('/usr/bin/sudo', { rootOwned: true }, fs(system))).toEqual([])
  })

  it('rejects a group- or world-writable component, a foreign owner and a missing file', () => {
    expect(
      trustIssues(
        '/usr/bin/sudo',
        { rootOwned: true },
        fs({ ...system, '/usr/bin': entry(0, 0o40777) }),
      ),
    ).toEqual(['/usr/bin is writable by group or others'])
    expect(
      trustIssues(
        '/usr/bin/sudo',
        { rootOwned: true },
        fs({ ...system, '/usr/bin/sudo': entry(1001, 0o100755, 'file') }),
      ),
    ).toEqual(['/usr/bin/sudo is not owned by root'])
    expect(trustIssues('/usr/bin/nope', { rootOwned: true }, fs(system))).toEqual([
      '/usr/bin/nope: ENOENT /usr/bin/nope',
    ])
  })

  it('checks the target of a symlink as well as the link itself', () => {
    const entries = {
      ...system,
      '/usr/bin/timeout': entry(0, 0o120777, 'link'),
      '/opt': entry(0, 0o40755),
      '/opt/evil': entry(1001, 0o40777),
      '/opt/evil/timeout': entry(1001, 0o100755, 'file'),
    }
    const issues = trustIssues(
      '/usr/bin/timeout',
      { rootOwned: true },
      fs(entries, { '/usr/bin/timeout': '/opt/evil/timeout' }),
    )
    expect(issues).toEqual([
      '/opt/evil is not owned by root',
      '/opt/evil is writable by group or others',
      '/opt/evil/timeout is not owned by root',
    ])
  })

  it('for a toolchain, only rejects what others can write', () => {
    const entries = {
      '/': entry(0, 0o40755),
      '/opt': entry(0, 0o40755),
      '/opt/py': entry(1001, 0o40775),
      '/opt/py/python3': entry(1001, 0o100755, 'file'),
    }
    expect(trustIssues('/opt/py/python3', { rootOwned: false }, fs(entries))).toEqual([])
    expect(
      trustIssues(
        '/opt/py/python3',
        { rootOwned: false },
        fs({ ...entries, '/opt/py': entry(1001, 0o40777) }),
      ),
    ).toEqual(['/opt/py is writable by others'])
  })
})

describe('assertSandboxPolicy', () => {
  it('fails closed on GitHub Actions without a sandbox user (fix 6)', () => {
    expect(() => assertSandboxPolicy({ GITHUB_ACTIONS: 'true' })).toThrow(
      /CONTENT_VERIFY_SANDBOX_USER/,
    )
    expect(() =>
      assertSandboxPolicy({ GITHUB_ACTIONS: 'true', CONTENT_VERIFY_SANDBOX_USER: '  ' }),
    ).toThrow(/CONTENT_VERIFY_SANDBOX_USER/)
  })

  it('returns the sandbox user when one is set', () => {
    expect(
      assertSandboxPolicy({ GITHUB_ACTIONS: 'true', CONTENT_VERIFY_SANDBOX_USER: 'cvsandbox' }),
    ).toEqual({ user: 'cvsandbox' })
    expect(assertSandboxPolicy({ CONTENT_VERIFY_SANDBOX_USER: 'cvsandbox' })).toEqual({
      user: 'cvsandbox',
    })
  })

  it('runs unsandboxed locally', () => {
    expect(assertSandboxPolicy({})).toBeNull()
    expect(assertSandboxPolicy({ GITHUB_ACTIONS: 'false' })).toBeNull()
  })

  it('rejects a user name that is not a plain Linux user name', () => {
    expect(() => assertSandboxPolicy({ CONTENT_VERIFY_SANDBOX_USER: 'root; rm -rf /' })).toThrow(
      /user name/,
    )
    expect(() => assertSandboxPolicy({ CONTENT_VERIFY_SANDBOX_USER: 'root' })).toThrow(/root/)
  })
})
