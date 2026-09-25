/**
 * The content-verify sandbox (platform design §3.7, owner decision OD2, ADR-0012). In CI every
 * toolchain command — compile as well as each case (fix 6) — runs as a dedicated Linux user whose
 * network, loopback included, the workflow rejects with an iptables owner match. Locally (a
 * developer's own machine) commands run unsandboxed as the developer.
 *
 * Fences against a runaway solution, outermost first: the orchestrator's Node timer (SIGTERM, then
 * SIGKILL), the `timeout` inside the sandbox (`sudo` cannot relay SIGKILL), and
 * `killSandboxProcesses` after every command, so no process survives into the next case.
 */
import { spawnSync } from 'node:child_process'
import { rmSync } from 'node:fs'
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

/** Absolute paths, resolved before anything runs (`command -v`, so `sudo`'s `secure_path` never
 * decides which toolchain the sandbox user gets). */
export type ToolPaths = {
  python: string
  javac: string
  java: string
  go: string
  timeout: string
  sudo: string
}

/** The sandbox user's HOME: never the runner's home, nothing of the runner's in it. */
const SANDBOX_HOME = '/tmp'
/** A plain Linux user name; the value lands in `sudo -u` and `pkill -u` argv. */
const USER_NAME = /^[a-z_][a-z0-9_-]{0,31}$/

function sandboxPath(tools: ToolPaths): string {
  const dirs = [tools.python, tools.javac, tools.java, tools.go]
    .filter((tool) => tool !== '')
    .map((tool) => dirname(tool))
  return [...new Set(dirs)].join(':')
}

/**
 * The spawn for `command`. Unsandboxed: the command itself with only PATH, HOME and the command's
 * env (never the whole environment). Sandboxed: `sudo -n -u <user> -- <timeout> --kill-after=1
 * <ceil(s)+1>s env -i PATH=<tool dirs> HOME=/tmp <command env…> <absolute cmd> <args…>`.
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
    cmd: tools.sudo,
    args: [
      '-n',
      '-u',
      sandbox.user,
      '--',
      tools.timeout,
      '--kill-after=1',
      `${seconds}s`,
      'env',
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

/** `sudo -n pkill -KILL -u <user> || true` — after every command, so nothing a solution started
 * survives into the next case (fix 6). */
export function killSandboxProcesses(sandbox: Sandbox): void {
  if (sandbox === null) return
  spawnSync('sudo', ['-n', 'pkill', '-KILL', '-u', sandbox.user], { stdio: 'ignore' })
}

/** Hands a directory the harness wrote to the sandbox user, so compiling (`out/`, `bin`, the Go
 * caches) can write there. */
export function grantSandboxDir(sandbox: { user: string }, dir: string): void {
  const result = spawnSync('sudo', ['-n', 'chown', '-R', sandbox.user, dir], { encoding: 'utf8' })
  if (result.status !== 0) {
    throw new Error(`sudo chown -R ${sandbox.user} ${dir} failed: ${result.stderr.trim()}`)
  }
}

/** Where a run's work root goes. In sandbox mode always `/tmp`: the sandbox user must be able to
 * traverse every parent directory, and `TMPDIR` could point into the runner's home. */
export const workRootParent = (sandbox: Sandbox): string => (sandbox === null ? tmpdir() : '/tmp')

/** Deletes the work root; in sandbox mode its contents belong to the sandbox user. */
export function removeWorkRoot(sandbox: Sandbox, workRoot: string): void {
  if (!isAbsolute(workRoot)) throw new Error(`refusing to remove a relative path: ${workRoot}`)
  if (sandbox !== null) {
    spawnSync('sudo', ['-n', 'rm', '-rf', '--', workRoot], { stdio: 'ignore' })
    return
  }
  rmSync(workRoot, { recursive: true, force: true })
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
