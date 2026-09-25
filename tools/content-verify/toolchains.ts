/**
 * Resolves the toolchains before anything runs: absolute paths (looked up on PATH like `command
 * -v`, so `sudo`'s `secure_path` never picks the sandbox user's toolchain) and versions checked
 * against the local minimums (Part B-M3 decision 18: Python ≥ 3.11, JDK ≥ 21, Go ≥ 1.22; CI runs
 * Python 3.13, Temurin 25 compiling with `--release 21`, Go 1.26).
 */
import { spawnSync } from 'node:child_process'
import { accessSync, constants, statSync } from 'node:fs'
import { delimiter, isAbsolute, join } from 'node:path'
import type { CodeLanguage } from '@/lib/content/schemas/common'
import { assertTrustedBinaries, trustIssues, type Sandbox, type ToolPaths } from './sandbox'

type Tool = 'python' | 'javac' | 'java' | 'go'

const MINIMUM: Readonly<Record<Tool, { version: string; label: string }>> = {
  python: { version: '3.11', label: 'Python ≥ 3.11' },
  javac: { version: '21', label: 'JDK ≥ 21' },
  java: { version: '21', label: 'JDK ≥ 21' },
  go: { version: '1.22', label: 'Go ≥ 1.22' },
}

const EXECUTABLE: Readonly<Record<Tool, string>> = {
  python: 'python3',
  javac: 'javac',
  java: 'java',
  go: 'go',
}

const VERSION_ARGS: Readonly<Record<Tool, string[]>> = {
  python: ['--version'],
  javac: ['-version'],
  java: ['-version'],
  go: ['version'],
}

const VERSION_PATTERN: Readonly<Record<Tool, RegExp>> = {
  python: /Python (\d+\.\d+(?:\.\d+)?)/,
  javac: /javac (\d+(?:\.\d+)*)/,
  java: /version "(\d+(?:\.\d+)*)/,
  go: /go version go(\d+\.\d+(?:\.\d+)?)/,
}

/** The version a toolchain's version command prints (stdout and stderr together), or `null`. */
export function parseToolVersion(tool: Tool, output: string): string | null {
  return VERSION_PATTERN[tool].exec(output)?.[1] ?? null
}

/** Whether dotted `version` ≥ `minimum`, compared part by part. */
export function atLeast(version: string, minimum: string): boolean {
  const have = version.split('.').map(Number)
  const need = minimum.split('.').map(Number)
  for (let index = 0; index < Math.max(have.length, need.length); index++) {
    const a = have[index] ?? 0
    const b = need[index] ?? 0
    if (a !== b) return a > b
  }
  return true
}

/** The first executable `name` on `PATH`, like `command -v`; `null` when there is none. */
function findOnPath(name: string, path: string): string | null {
  for (const dir of path.split(delimiter)) {
    if (dir === '' || !isAbsolute(dir)) continue
    const candidate = join(dir, name)
    try {
      if (!statSync(candidate).isFile()) continue
      accessSync(candidate, constants.X_OK)
      return candidate
    } catch {
      // not here
    }
  }
  return null
}

const TOOLS_BY_LANGUAGE: Readonly<Record<CodeLanguage, Tool[]>> = {
  python: ['python'],
  java: ['javac', 'java'],
  go: ['go'],
}

/**
 * Absolute tool paths and a header summary (`python 3.13.7 · javac 23.0.2 · go 1.26.5`) for
 * `languages`. Throws when a toolchain is missing or too old, naming the minimum version. In
 * sandbox mode it also throws unless the sandbox's own binaries are root-owned and writable by
 * root only, and no toolchain is writable by others (the sandbox user must not be able to swap
 * what it, or the runner, executes next).
 */
export function resolveToolchains(
  languages: readonly CodeLanguage[],
  sandbox: Sandbox,
  env: Readonly<Record<string, string | undefined>> = process.env,
): { tools: ToolPaths; summary: string } {
  const path = env.PATH ?? ''
  const tools: ToolPaths = { python: '', javac: '', java: '', go: '' }
  const summary: string[] = []

  for (const lang of languages) {
    for (const tool of TOOLS_BY_LANGUAGE[lang]) {
      const { version: minimum, label } = MINIMUM[tool]
      const file = findOnPath(EXECUTABLE[tool], path)
      if (file === null) {
        throw new Error(`${EXECUTABLE[tool]} not found on PATH: content:verify needs ${label}`)
      }
      const result = spawnSync(file, VERSION_ARGS[tool], { encoding: 'utf8', timeout: 30_000 })
      const version = parseToolVersion(tool, `${result.stdout ?? ''}${result.stderr ?? ''}`)
      if (version === null) {
        throw new Error(`could not read the version of ${file}: content:verify needs ${label}`)
      }
      if (!atLeast(version, minimum)) {
        throw new Error(`${file} is ${version}: content:verify needs ${label}`)
      }
      tools[tool] = file
      if (tool !== 'java') summary.push(`${tool} ${version}`)
    }
  }

  if (sandbox !== null) {
    assertTrustedBinaries()
    const issues = Object.values(tools)
      .filter((file) => file !== '')
      .flatMap((file) => trustIssues(file, { rootOwned: false }))
    if (issues.length > 0) {
      throw new Error(`a toolchain is writable by others: ${issues.join('; ')}`)
    }
  }
  return { tools, summary: summary.join(' · ') }
}
