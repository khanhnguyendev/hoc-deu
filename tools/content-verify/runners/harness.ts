/**
 * What every language runner provides (platform design §3.7, Part B-M3 decision 19): runners only
 * execute a solution and print JSON; the Node orchestrator compares and enforces the timeouts.
 * Each problem × language compiles once and runs once per case; arguments are positional.
 */
import type { CodeLanguage } from '@/lib/content/schemas/common'
import { parseValueType, type TestsFile, type ValueType } from '@/lib/content/schemas/tests'
import { verificationFor, type Verification } from '@/lib/content/verification'
import type { ProblemUnderTest } from '../discover'
import type { Command } from '../sandbox'

/** Toolchain commands name their tool (resolved to an absolute path by the orchestrator) or give
 * an absolute path (a built binary). */
export type ToolName = 'python' | 'javac' | 'java' | 'go'

export type Prepared = {
  /** `tested`: build once before the cases (may be empty). */
  compile: Command[]
  /** `tested`: run once after the build, untimed and unjudged (macOS scans a freshly linked
   * binary on its first exec, ~0.5 s, which must not count against the first case). */
  warmUp: Command[]
  /** `tested`: the command for `tests.cases[index]`. */
  runCase(index: number): Command
  /** `compile-only`: the syntax / compile checks. */
  compileOnly: Command[]
  /** `compile-only`: declarations the signature check could not find in the source. */
  signatureIssues: string[]
  /** Directories outside the work directory that the commands write (the Go caches); in sandbox
   * mode the sandbox user must own them. */
  sharedDirs: string[]
}

export type Harness = {
  lang: CodeLanguage
  /** Writes the harness into `workDir` (copies the solution and the static runner files,
   * generates code) for the problem's verification mode. `workDir` is a direct child of the
   * work root. */
  prepare(problem: ProblemUnderTest, workDir: string): Prepared
}

/** Per-case timeouts come from `tests.yaml`; builds get these. */
export const COMPILE_TIMEOUT_MS = {
  check: 30_000,
  javac: 60_000,
  go: 120_000,
  warmUp: 10_000,
} as const

export type FunctionCall = {
  name: string
  params: { name: string; type: ValueType }[]
  returnsVoid: boolean
  /** The parameter index an in-place signature reports instead of the return value. */
  output: number | null
}

/** The call a `function` signature describes: parameters in declaration order. */
export function functionCall(tests: TestsFile): FunctionCall {
  const { signature, compare } = tests
  if (signature.kind !== 'function') {
    throw new Error(`a ${signature.kind} signature has no runner yet`)
  }
  const params = Object.entries(signature.params).map(([name, text]) => {
    const type = parseValueType(text)
    if (type === null) throw new Error(`parameter "${name}": unknown type "${text}"`)
    return { name, type }
  })
  const output =
    compare.kind === 'in-place' ? params.findIndex((param) => param.name === compare.arg) : -1
  return {
    name: signature.name,
    params,
    returnsVoid: signature.returns === 'void',
    output: output === -1 ? null : output,
  }
}

/** The positional arguments of case `index`. */
export function caseArguments(tests: TestsFile, index: number): unknown[] {
  const testCase = tests.cases[index]
  if (testCase === undefined || !('input' in testCase)) {
    throw new Error(`case ${index} is not a { name, input, expected } case`)
  }
  return functionCall(tests).params.map((param) => testCase.input[param.name])
}

/** The class and method names the signature check looks for: `Solution` + the function for
 * `function` and the M3b kinds, the class and every method for `design-class`. */
export function signatureTargets(tests: TestsFile): { className: string; methods: string[] } {
  const { signature } = tests
  if (signature.kind === 'design-class') {
    return { className: signature.className, methods: Object.keys(signature.methods) }
  }
  return { className: 'Solution', methods: [signature.name] }
}

export const modeOf = (problem: ProblemUnderTest): Verification =>
  verificationFor(problem.tests.signature.kind)

export function noCases(): never {
  throw new Error('a compile-only problem runs no cases')
}

/** A case's comment line in generated code (case names are `[a-z0-9-]`). */
export const caseName = (tests: TestsFile, index: number): string => tests.cases[index]?.name ?? ''
