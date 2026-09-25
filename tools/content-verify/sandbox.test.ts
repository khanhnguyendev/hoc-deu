import { describe, expect, it } from 'vitest'
import {
  assertSandboxPolicy,
  killSandboxProcesses,
  wrapCommand,
  type Command,
  type ToolPaths,
} from './sandbox'

const tools: ToolPaths = {
  python: '/opt/py/bin/python3',
  javac: '/opt/jdk/bin/javac',
  java: '/opt/jdk/bin/java',
  go: '/opt/go/bin/go',
  timeout: '/usr/bin/timeout',
  sudo: '/usr/bin/sudo',
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
  const sandbox = { user: 'cvsandbox' }

  it('runs a case as the sandbox user under timeout with a cleared environment', () => {
    expect(wrapCommand(runCommand, sandbox, tools)).toEqual({
      cmd: '/usr/bin/sudo',
      args: [
        '-n',
        '-u',
        'cvsandbox',
        '--',
        '/usr/bin/timeout',
        '--kill-after=1',
        '3s',
        'env',
        '-i',
        'PATH=/opt/py/bin:/opt/jdk/bin:/opt/go/bin',
        'HOME=/tmp',
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
        '-n',
        '-u',
        'cvsandbox',
        '--',
        '/usr/bin/timeout',
        '--kill-after=1',
        '121s',
        'env',
        '-i',
        'PATH=/opt/py/bin:/opt/jdk/bin:/opt/go/bin',
        'HOME=/tmp',
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

describe('killSandboxProcesses', () => {
  it('does nothing without a sandbox', () => {
    expect(() => killSandboxProcesses(null)).not.toThrow()
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
