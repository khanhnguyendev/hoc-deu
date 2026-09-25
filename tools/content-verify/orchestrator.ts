/**
 * The content-verify orchestrator (platform design §3.7, Part B-M3 decision 19): for each problem
 * × language it prepares the harness, compiles once, runs every case under a Node-enforced
 * timeout, parses the JSON the runner prints and compares it (3.5a's comparators). Unsupported
 * signature kinds get the compile-only checks instead (decision 21).
 *
 * Locally units run in parallel; in sandbox mode one at a time, because the `pkill -u` after each
 * command must never hit another unit's running case.
 */
import { spawn } from 'node:child_process'
import { chmodSync, mkdirSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'
import type { CodeLanguage } from '@/lib/content/schemas/common'
import type { SignatureKind, TestsFile } from '@/lib/content/schemas/tests'
import { verificationFor, type Verification } from '@/lib/content/verification'
import { compare } from './comparators'
import type { ProblemUnderTest } from './discover'
import { goHarness } from './runners/go'
import type { Harness, Prepared, ToolName } from './runners/harness'
import { javaHarness } from './runners/java'
import { pythonHarness } from './runners/python'
import {
  childEnv,
  grantSandboxDir,
  killSandboxProcesses,
  wrapCommand,
  type Command,
  type Sandbox,
  type Spawn,
  type ToolPaths,
} from './sandbox'

export type { ToolPaths } from './sandbox'

export type CaseResult = {
  name: string
  status: 'pass' | 'fail' | 'timeout' | 'error'
  ms: number
  detail?: string
}
export type LanguageResult = {
  lang: CodeLanguage
  status: 'tested' | 'compile-only' | 'failed'
  cases: CaseResult[]
  detail?: string
}
export type ProblemResult = {
  id: string
  kind: SignatureKind
  verification: Verification
  languages: LanguageResult[]
  ok: boolean
}

export type ExecResult = {
  exitCode: number | null
  stdout: string
  stderr: string
  ms: number
  timedOut: boolean
}
export type Exec = (
  target: Spawn,
  options: { cwd: string; stdin?: string; timeoutMs: number },
) => Promise<ExecResult>

export type OrchestratorDeps = {
  exec: Exec
  killSandboxProcesses: (sandbox: Sandbox) => void
  grantSandboxDir: (sandbox: { user: string }, dir: string) => void
}

export const HARNESSES: Readonly<Record<CodeLanguage, Harness>> = {
  python: pythonHarness,
  java: javaHarness,
  go: goHarness,
}

/** SIGTERM first; SIGKILL this long after; give up waiting this long after that. */
const KILL_GRACE_MS = 1000
/** Output beyond this is dropped (a runaway print loop must not fill the orchestrator's memory). */
const OUTPUT_LIMIT_BYTES = 1024 * 1024
const EXCERPT_LINES = 20
const SHORT_JSON = 80

function collector() {
  const chunks: Buffer[] = []
  let size = 0
  return {
    add(chunk: Buffer) {
      if (size >= OUTPUT_LIMIT_BYTES) return
      chunks.push(chunk)
      size += chunk.length
    },
    text: () => Buffer.concat(chunks).subarray(0, OUTPUT_LIMIT_BYTES).toString('utf8'),
  }
}

/** Spawns `target` with a timer: SIGTERM at `timeoutMs`, SIGKILL a second later, and after one
 * more second the case is reported without waiting (a sandboxed child may not be ours to kill —
 * the inner `timeout` and the per-case `pkill` finish it). */
export const execCommand: Exec = (target, { cwd, stdin, timeoutMs }) =>
  new Promise((resolve) => {
    const started = performance.now()
    const stdout = collector()
    const stderr = collector()
    const timers: NodeJS.Timeout[] = []
    let timedOut = false
    let settled = false

    const child = spawn(target.cmd, target.args, {
      cwd,
      env: childEnv(target.env),
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    const finish = (exitCode: number | null, note = ''): void => {
      if (settled) return
      settled = true
      for (const timer of timers) clearTimeout(timer)
      resolve({
        exitCode,
        stdout: stdout.text(),
        stderr: stderr.text() + note,
        ms: Math.round(performance.now() - started),
        timedOut,
      })
    }
    const signal = (name: NodeJS.Signals): void => {
      try {
        child.kill(name)
      } catch {
        // not ours to signal (a sandboxed child); the fences inside the sandbox take over
      }
    }

    timers.push(
      setTimeout(() => {
        timedOut = true
        signal('SIGTERM')
        timers.push(
          setTimeout(() => {
            signal('SIGKILL')
            timers.push(setTimeout(() => finish(null), KILL_GRACE_MS))
          }, KILL_GRACE_MS),
        )
      }, timeoutMs),
    )
    child.stdout.on('data', (chunk: Buffer) => stdout.add(chunk))
    child.stderr.on('data', (chunk: Buffer) => stderr.add(chunk))
    child.on('error', (error) => finish(null, error.message))
    child.on('close', (code) => finish(code))
    child.stdin.on('error', () => {
      // the child may exit without reading its input
    })
    child.stdin.end(stdin ?? '')
  })

/** The first `EXCERPT_LINES` non-empty lines. */
export function excerpt(text: string): string {
  return text
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line !== '')
    .slice(0, EXCERPT_LINES)
    .join('\n')
}

function shortJson(value: unknown): string {
  const text = JSON.stringify(value) ?? String(value)
  return text.length > SHORT_JSON ? `${text.slice(0, SHORT_JSON - 1)}…` : text
}

const TOOL_NAMES: ReadonlySet<string> = new Set<ToolName>(['python', 'javac', 'java', 'go'])

function resolveTool(command: Command, tools: ToolPaths): Command {
  if (TOOL_NAMES.has(command.cmd)) {
    const path = tools[command.cmd as ToolName]
    if (path === '') throw new Error(`no ${command.cmd} toolchain was resolved`)
    return { ...command, cmd: path }
  }
  if (!isAbsolute(command.cmd)) throw new Error(`not a tool name or absolute path: ${command.cmd}`)
  return command
}

function judge(tests: TestsFile, index: number, command: Command, result: ExecResult): CaseResult {
  const testCase = tests.cases[index]
  if (testCase === undefined || !('input' in testCase)) {
    throw new Error(`case ${index} is not a { name, input, expected } case`)
  }
  const base = { name: testCase.name, ms: result.ms }
  if (result.timedOut) {
    return { ...base, status: 'timeout', detail: `timed out after ${command.timeoutMs} ms` }
  }
  if (result.exitCode !== 0) {
    const reason = excerpt(result.stderr) || `exit code ${result.exitCode}`
    return { ...base, status: 'error', detail: `crashed: ${reason}` }
  }
  let actual: unknown
  try {
    actual = JSON.parse(result.stdout)
  } catch {
    const shown =
      result.stdout.trim() === '' ? '(empty)' : result.stdout.trim().slice(0, SHORT_JSON)
    return { ...base, status: 'error', detail: `invalid output: ${shown}` }
  }
  const verdict = compare(tests.compare, actual, testCase.expected, testCase.input)
  if (verdict.ok) return { ...base, status: 'pass' }
  const why = tests.compare.kind === 'validator' ? ` (${verdict.reason})` : ''
  return {
    ...base,
    status: 'fail',
    detail: `expected ${shortJson(testCase.expected)} got ${shortJson(actual)}${why}`,
  }
}

type Context = {
  workRoot: string
  sandbox: Sandbox
  tools: ToolPaths
  deps: OrchestratorDeps
}

const failed = (lang: CodeLanguage, detail: string): LanguageResult => ({
  lang,
  status: 'failed',
  cases: [],
  detail,
})

async function verifyUnit(
  problem: ProblemUnderTest,
  lang: CodeLanguage,
  context: Context,
): Promise<LanguageResult> {
  const { sandbox, tools, deps } = context
  const workDir = join(context.workRoot, `${problem.id.replace(':', '_')}-${lang}`)
  mkdirSync(workDir)

  let prepared: Prepared
  try {
    prepared = HARNESSES[lang].prepare(problem, workDir)
  } catch (error) {
    return failed(lang, `harness: ${error instanceof Error ? error.message : String(error)}`)
  }
  if (sandbox !== null) {
    for (const dir of [workDir, ...prepared.sharedDirs]) deps.grantSandboxDir(sandbox, dir)
  }

  const run = async (command: Command): Promise<ExecResult> => {
    const target = wrapCommand(resolveTool(command, tools), sandbox, tools)
    const options = { cwd: command.cwd, timeoutMs: command.timeoutMs }
    const result = await deps.exec(
      target,
      command.stdin === undefined ? options : { ...options, stdin: command.stdin },
    )
    if (sandbox !== null) deps.killSandboxProcesses(sandbox)
    return result
  }
  /** Runs build steps in order; the first failure's reason, or null. */
  const build = async (commands: readonly Command[]): Promise<string | null> => {
    for (const command of commands) {
      const result = await run(command)
      if (result.timedOut) return `timed out after ${command.timeoutMs} ms`
      if (result.exitCode !== 0) {
        return excerpt(result.stderr) || excerpt(result.stdout) || `exit code ${result.exitCode}`
      }
    }
    return null
  }

  if (verificationFor(problem.tests.signature.kind) === 'compile-only') {
    const failure = await build(prepared.compileOnly)
    if (failure !== null) return failed(lang, failure)
    if (prepared.signatureIssues.length > 0) {
      return failed(lang, prepared.signatureIssues.join('\n'))
    }
    return { lang, status: 'compile-only', cases: [] }
  }

  const failure = await build(prepared.compile)
  if (failure !== null) return failed(lang, failure)
  for (const command of prepared.warmUp) await run(command)
  const cases: CaseResult[] = []
  for (let index = 0; index < problem.tests.cases.length; index++) {
    const command = prepared.runCase(index)
    cases.push(judge(problem.tests, index, command, await run(command)))
  }
  const passed = cases.every((testCase) => testCase.status === 'pass')
  return { lang, status: passed ? 'tested' : 'failed', cases }
}

async function pool<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0
  const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next] as T
      next += 1
      await worker(item)
    }
  })
  await Promise.all(lanes)
}

/**
 * Verifies every problem × language. `jobs` units run in parallel without a sandbox; with one,
 * exactly one unit runs at a time. `workRoot` is an empty directory the caller creates for this
 * run and removes afterwards (`removeWorkRoot`); the unit directories live under it. Nothing is
 * written into `content/`.
 */
export async function verifyProblems(
  problems: readonly ProblemUnderTest[],
  options: {
    jobs: number
    workRoot: string
    sandbox: Sandbox
    tools: ToolPaths
    deps?: Partial<OrchestratorDeps>
  },
): Promise<ProblemResult[]> {
  const context: Context = {
    workRoot: options.workRoot,
    sandbox: options.sandbox,
    tools: options.tools,
    deps: { exec: execCommand, killSandboxProcesses, grantSandboxDir, ...options.deps },
  }
  // The sandbox user must be able to reach its unit directories inside the (0700) temp dir.
  if (options.sandbox !== null) chmodSync(options.workRoot, 0o711)

  const results = problems.map(() => new Map<CodeLanguage, LanguageResult>())
  const units = problems.flatMap((problem, position) =>
    problem.languages.map((lang) => ({ problem, position, lang })),
  )
  const jobs = options.sandbox === null ? Math.max(1, Math.floor(options.jobs)) : 1
  await pool(units, jobs, async ({ problem, position, lang }) => {
    results[position]?.set(lang, await verifyUnit(problem, lang, context))
  })

  return problems.map((problem, position) => {
    const byLang = results[position]
    const languages = problem.languages.flatMap((lang) => {
      const result = byLang?.get(lang)
      return result === undefined ? [] : [result]
    })
    return {
      id: problem.id,
      kind: problem.tests.signature.kind,
      verification: verificationFor(problem.tests.signature.kind),
      languages,
      ok: languages.every((language) => language.status !== 'failed'),
    }
  })
}
