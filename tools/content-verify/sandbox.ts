/**
 * The content-verify sandbox (platform design §3.7, owner decision OD2, ADR-0012). In CI every
 * toolchain command — compile as well as each case (fix 6) — runs as a dedicated Linux user whose
 * network, loopback included, the workflow rejects with an iptables owner match. Locally (a
 * developer's own machine) commands run unsandboxed as the developer.
 *
 * Fences against a runaway solution, outermost first: the orchestrator's Node timer (SIGTERM, then
 * SIGKILL), the `timeout` inside the sandbox (`sudo` cannot relay SIGKILL), `prlimit` caps on
 * processes and file size, and `killSandboxProcesses` after every command, so no process survives
 * into the next case.
 *
 * Everything the runner (or root) executes once sandboxed code has run is a fixed, root-owned
 * absolute path (`SANDBOX_BINARIES`), never a PATH lookup: the sandbox user must not be able to
 * plant a `sudo` the runner would then run (fix round 1).
 */
import { spawnSync } from 'node:child_process'
import { lstatSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute } from 'node:path'

export type Sandbox = { user: string } | null

/** A toolchain command as a harness describes it. */
export type Command = {
  cmd: string
  args: string[]
  cwd: string
  stdin?: string
  env?: Record<string, string>
  timeoutMs: number
}

/** What actually gets spawned: the child's whole environment is `env`. */
export type Spawn = { cmd: string; args: string[]; env: Record<string, string> }

/** `env` typed for `child_process` (Next.js declares a required `NODE_ENV` on `ProcessEnv`; a
 * toolchain child must not inherit one). */
export const childEnv = (env: Record<string, string>): NodeJS.ProcessEnv => env as NodeJS.ProcessEnv

/** The toolchains, as absolute paths resolved before any solution runs. */
export type ToolPaths = { python: string; javac: string; java: string; go: string }

/** Privileged and post-sandbox commands: fixed paths on the Ubuntu runner, checked root-owned
 * and writable by nobody else (`trustIssues`) before sandbox mode starts. */
export const SANDBOX_BINARIES = {
  sudo: '/usr/bin/sudo',
  timeout: '/usr/bin/timeout',
  prlimit: '/usr/bin/prlimit',
  env: '/usr/bin/env',
  pkill: '/usr/bin/pkill',
  pgrep: '/usr/bin/pgrep',
  chown: '/usr/bin/chown',
  rm: '/usr/bin/rm',
} as const

/**
 * Resource caps inside the sandbox (`prlimit`, per command): 512 processes/threads for the user
 * (a JVM or `go build -p 4` uses well under 100), 256 MiB per written file (a Go build cache entry
 * or binary is a few MiB), no core dumps. Memory is capped by `-Xmx` for Java only: an address
 * space limit breaks the JVM's reservations.
 */
export const SANDBOX_LIMITS = ['--nproc=512', `--fsize=${256 * 1024 * 1024}`, '--core=0'] as const

/** The sandbox user's HOME: never the runner's home, nothing of the runner's in it. */
const SANDBOX_HOME = '/tmp'
/** A plain Linux user name; the value lands in `sudo -u` and `pkill -u` argv. */
const USER_NAME = /^[a-z_][a-z0-9_-]{0,31}$/

/** `spawnSync`, narrowed so tests can record privileged calls. */
export type RunSync = (
  cmd: string,
  args: readonly string[],
) => { status: number | null; stderr: string }

const runSync: RunSync = (cmd, args) => {
  const result = spawnSync(cmd, args, { encoding: 'utf8', env: childEnv({}) })
  return { status: result.status, stderr: result.stderr ?? String(result.error ?? '') }
}

function sandboxPath(tools: ToolPaths): string {
  const dirs = [tools.python, tools.javac, tools.java, tools.go]
    .filter((tool) => tool !== '')
    .map((tool) => dirname(tool))
  return [...new Set(dirs)].join(':')
}

/**
 * The spawn for `command`. Unsandboxed: the command itself with only PATH, HOME and the command's
 * env (never the whole environment). Sandboxed: `sudo -n -u <user> -- timeout --kill-after=1
 * <ceil(s)+1>s prlimit <caps> -- env -i PATH=<tool dirs> HOME=/tmp <command env…> <absolute cmd>
 * <args…>`, every wrapper an absolute path.
 */
export function wrapCommand(command: Command, sandbox: Sandbox, tools: ToolPaths): Spawn {
  const commandEnv = command.env ?? {}
  if (sandbox === null) {
    const env: Record<string, string> = {}
    if (process.env.PATH !== undefined) env.PATH = process.env.PATH
    if (process.env.HOME !== undefined) env.HOME = process.env.HOME
    return { cmd: command.cmd, args: [...command.args], env: { ...env, ...commandEnv } }
  }
  if (!isAbsolute(command.cmd)) {
    throw new Error(`sandboxed commands need an absolute path, got "${command.cmd}"`)
  }
  const seconds = Math.ceil(command.timeoutMs / 1000) + 1
  return {
    cmd: SANDBOX_BINARIES.sudo,
    args: [
      '-n',
      '-u',
      sandbox.user,
      '--',
      SANDBOX_BINARIES.timeout,
      '--kill-after=1',
      `${seconds}s`,
      SANDBOX_BINARIES.prlimit,
      ...SANDBOX_LIMITS,
      '--',
      SANDBOX_BINARIES.env,
      '-i',
      `PATH=${sandboxPath(tools)}`,
      `HOME=${SANDBOX_HOME}`,
      ...Object.entries(commandEnv).map(([key, value]) => `${key}=${value}`),
      command.cmd,
      ...command.args,
    ],
    // sudo resets the environment anyway; give it nothing of the runner's to begin with.
    env: {},
  }
}

const pause = (ms: number): void => {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

/**
 * `pkill -KILL` the sandbox user's processes, by effective and by real user, until `pgrep` finds
 * none — after every command, so nothing a solution started survives into the next case (fix 6).
 * Throws (the run stops, exit 2) when a process outlives every round or `pgrep` fails.
 */
export function killSandboxProcesses(
  sandbox: Sandbox,
  run: RunSync = runSync,
  { rounds = 20, pauseMs = 50 }: { rounds?: number; pauseMs?: number } = {},
): void {
  if (sandbox === null) return
  const { sudo, pkill, pgrep } = SANDBOX_BINARIES
  for (let round = 0; round < rounds; round++) {
    run(sudo, ['-n', pkill, '-KILL', '-u', sandbox.user])
    run(sudo, ['-n', pkill, '-KILL', '-U', sandbox.user])
    const left = [run(pgrep, ['-u', sandbox.user]).status, run(pgrep, ['-U', sandbox.user]).status]
    if (left.some((status) => status !== 0 && status !== 1)) {
      throw new Error(`pgrep failed (status ${left.join(', ')}) while clearing ${sandbox.user}`)
    }
    if (left.every((status) => status === 1)) return
    pause(pauseMs)
  }
  throw new Error(`${sandbox.user} still has processes after ${rounds} rounds of pkill -KILL`)
}

/**
 * Hands a directory to the sandbox user so compiling can write there. A unit directory goes
 * recursively (`-R -P`: the runner has just written it and symlinks are not followed); a shared
 * directory goes once, empty, and only itself — never re-chowned after sandboxed code filled it.
 */
export function grantSandboxDir(
  sandbox: { user: string },
  dir: string,
  { recursive }: { recursive: boolean },
  run: RunSync = runSync,
): void {
  const mode = recursive ? ['-R', '-P'] : ['-h']
  const result = run(SANDBOX_BINARIES.sudo, [
    '-n',
    SANDBOX_BINARIES.chown,
    ...mode,
    '--',
    sandbox.user,
    dir,
  ])
  if (result.status !== 0) {
    throw new Error(`sudo chown ${sandbox.user} ${dir} failed: ${result.stderr.trim()}`)
  }
}

/** Where a run's work root goes. In sandbox mode always `/tmp`: the sandbox user must be able to
 * traverse every parent directory, and `TMPDIR` points into the runner's home in CI. */
export const workRootParent = (sandbox: Sandbox): string => (sandbox === null ? tmpdir() : '/tmp')

/** Deletes the work root; in sandbox mode its contents belong to the sandbox user (`rm -rf`
 * follows no symlink). */
export function removeWorkRoot(sandbox: Sandbox, workRoot: string, run: RunSync = runSync): void {
  if (!isAbsolute(workRoot)) throw new Error(`refusing to remove a relative path: ${workRoot}`)
  if (sandbox !== null) {
    run(SANDBOX_BINARIES.sudo, ['-n', SANDBOX_BINARIES.rm, '-rf', '--', workRoot])
    return
  }
  rmSync(workRoot, { recursive: true, force: true })
}

export type StatLike = {
  uid: number
  mode: number
  isFile(): boolean
  isDirectory(): boolean
  isSymbolicLink(): boolean
}

/** `/a/b/c` → `['/', '/a', '/a/b', '/a/b/c']`. */
function components(path: string): string[] {
  const parts = path.split('/').filter((part) => part !== '')
  return ['/', ...parts.map((_, index) => `/${parts.slice(0, index + 1).join('/')}`)]
}

/**
 * Why executing `path` could run something the sandbox user controls. Every directory from `/`
 * down to the file, along the given path and along its resolved target, must be writable by its
 * owner only: `rootOwned` (privileged binaries) also requires root to own each one, otherwise
 * (toolchains owned by the runner) only the others-write bit is refused. Symlink permissions are
 * meaningless; their directories are checked instead. `[]` means trusted.
 */
export function trustIssues(
  path: string,
  { rootOwned }: { rootOwned: boolean },
  fs: { lstat: (path: string) => StatLike; realpath: (path: string) => string } = {
    lstat: lstatSync,
    realpath: realpathSync,
  },
): string[] {
  const issues: string[] = []
  try {
    const target = fs.realpath(path)
    const chain = [...new Set([...components(path), ...components(target)])]
    for (const component of chain) {
      const stat = fs.lstat(component)
      if (stat.isSymbolicLink()) continue
      if (rootOwned && stat.uid !== 0) issues.push(`${component} is not owned by root`)
      if (rootOwned && (stat.mode & 0o022) !== 0) {
        issues.push(`${component} is writable by group or others`)
      }
      if (!rootOwned && (stat.mode & 0o002) !== 0) issues.push(`${component} is writable by others`)
    }
    if (!fs.lstat(target).isFile()) issues.push(`${target} is not a regular file`)
  } catch (error) {
    issues.push(`${path}: ${error instanceof Error ? error.message : String(error)}`)
  }
  return issues
}

/** Throws unless every `SANDBOX_BINARIES` entry is root-owned and writable by root only. */
export function assertTrustedBinaries(): void {
  const issues = Object.values(SANDBOX_BINARIES).flatMap((path) =>
    trustIssues(path, { rootOwned: true }),
  )
  if (issues.length > 0) {
    throw new Error(`the sandbox's own binaries are not trustworthy: ${issues.join('; ')}`)
  }
}

/**
 * The sandbox from the environment: `CONTENT_VERIFY_SANDBOX_USER` names it. On GitHub Actions
 * (`GITHUB_ACTIONS=true`) a missing sandbox user is an error — CI never runs solutions unsandboxed
 * (fail closed, fix 6); the CLI exits 2.
 */
export function assertSandboxPolicy(env: Readonly<Record<string, string | undefined>>): Sandbox {
  const user = env.CONTENT_VERIFY_SANDBOX_USER?.trim() ?? ''
  if (user !== '') {
    if (!USER_NAME.test(user)) {
      throw new Error(`CONTENT_VERIFY_SANDBOX_USER="${user}" is not a plain Linux user name`)
    }
    if (user === 'root') {
      throw new Error('CONTENT_VERIFY_SANDBOX_USER must not be root')
    }
    return { user }
  }
  if (env.GITHUB_ACTIONS === 'true') {
    throw new Error(
      'refusing to run solutions unsandboxed on GitHub Actions: set ' +
        'CONTENT_VERIFY_SANDBOX_USER to the no-network sandbox user (ADR-0012)',
    )
  }
  return null
}
