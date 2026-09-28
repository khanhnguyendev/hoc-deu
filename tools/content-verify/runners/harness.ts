/**
 * What every language runner provides (platform design §3.7, Part B-M3 decision 19): runners only
 * execute a solution and print JSON; the Node orchestrator compares and enforces the timeouts.
 * Each problem × language compiles once and runs once per case; arguments are positional.
 */
import { constants, copyFileSync, lstatSync } from 'node:fs'
import { basename } from 'node:path'
import type { CodeLanguage } from '@/lib/content/schemas/common'
import {
  parseParamType,
  type ParamType,
  type SignatureKind,
  type Structure,
  type TestsFile,
} from '@/lib/content/schemas/tests'
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
  params: { name: string; type: ParamType }[]
  /** `null`: `void`. */
  returns: ParamType | null
  /** The parameter index an in-place signature reports instead of the return value. */
  output: number | null
  /** `graph-node` / `random-list` (133, 138): the result must be a deep copy of this parameter —
   * the harness fails a result that reuses one of its nodes. */
  copyOf: number | null
}

const DEEP_COPY_KINDS: ReadonlySet<SignatureKind> = new Set(['graph-node', 'random-list'])

/** The call a `function` or structured signature (M3b) describes: parameters in declaration
 * order, each a value type or a structure the harness decodes; a structure result is encoded
 * back to its `tests.yaml` form before it is printed. */
export function functionCall(tests: TestsFile): FunctionCall {
  const { signature, compare } = tests
  if (signature.kind === 'design-class') {
    throw new Error('a design-class signature has no runner yet')
  }
  const parse = (label: string, text: string): ParamType => {
    const type = parseParamType(signature.kind, text)
    if (type === null) throw new Error(`${label}: unknown type "${text}"`)
    return type
  }
  const params = Object.entries(signature.params).map(([name, text]) => ({
    name,
    type: parse(`parameter "${name}"`, text),
  }))
  const returns = signature.returns === 'void' ? null : parse('returns', signature.returns)
  const output =
    compare.kind === 'in-place' ? params.findIndex((param) => param.name === compare.arg) : -1
  const copyOf =
    DEEP_COPY_KINDS.has(signature.kind) && returns?.kind === 'structure'
      ? params.findIndex((param) => param.type.kind === 'structure')
      : -1
  return {
    name: signature.name,
    params,
    returns,
    output: output === -1 ? null : output,
    copyOf: copyOf === -1 ? null : copyOf,
  }
}

/** The structures a call decodes or encodes (which structure classes / codecs the harness needs). */
export function callStructures(call: FunctionCall): Set<Structure> {
  const structures = new Set<Structure>()
  for (const type of [...call.params.map((param) => param.type), call.returns]) {
    if (type?.kind === 'structure') structures.add(type.structure)
  }
  return structures
}

/** The type whose encoding the harness prints: the in-place argument's, else the return type. */
export function reportedType(call: FunctionCall): ParamType | null {
  return call.output === null ? call.returns : (call.params[call.output]?.type ?? null)
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

/** Copies a regular file into the work directory. Content is never read through a symlink: the
 * runner would copy whatever it points at (a runner file, a secret) where the solution can print
 * it. The destination must not exist yet. */
export function copyRegularFile(source: string, destination: string): void {
  if (!lstatSync(source).isFile()) {
    throw new Error(`${basename(source)} is not a regular file (a symlink?); it is never followed`)
  }
  copyFileSync(source, destination, constants.COPYFILE_EXCL)
}
