/**
 * Guards the content-verify workflow (ADR-0012): the in-job path check must cover everything the
 * harness imports (derived, not listed by hand), every step after it carries its `if:` (fix 17),
 * and the sandbox steps keep their order and strict shell.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { parse as parseYaml } from 'yaml'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(import.meta.dirname, '..', '..')
const WORKFLOW = join(ROOT, '.github', 'workflows', 'content-verify.yml')
const RUN_IF = "steps.paths.outputs.run == 'true'"

type Step = { id?: string; name?: string; if?: string; run?: string; shell?: string; uses?: string }
const workflow = parseYaml(readFileSync(WORKFLOW, 'utf8')) as {
  jobs: { 'content-verify': { steps: Step[] } }
}
const steps = workflow.jobs['content-verify'].steps
const pathsIndex = steps.findIndex((step) => step.id === 'paths')
const later = steps.slice(pathsIndex + 1)

/** The pathspecs after `git diff --quiet "$BASE" HEAD --` in the paths step. */
function checkedPaths(): string[] {
  const script = (steps[pathsIndex]?.run ?? '').replace(/\\\n/g, ' ')
  const match = /git diff --quiet "\$BASE" HEAD --\s+([^;]+);/.exec(script)
  if (match === null) throw new Error('no git diff pathspec in the paths step')
  return (match[1] ?? '').trim().split(/\s+/)
}

/** Repository files `tools/content-verify` imports, transitively (`@/` and relative imports). */
function harnessImports(): string[] {
  const dir = join(ROOT, 'tools', 'content-verify')
  const queue = readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.ts') && !file.includes('__fixtures__'))
    .map((file) => join(dir, file))
  const seen = new Set<string>()
  const resolveSpecifier = (from: string, specifier: string): string | null => {
    let base: string
    if (specifier.startsWith('@/')) base = join(ROOT, specifier.slice(2))
    else if (specifier.startsWith('.')) base = resolve(dirname(from), specifier)
    else return null // a package: covered by package.json and the lockfile
    for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
      if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
    }
    throw new Error(`cannot resolve ${specifier} from ${from}`)
  }
  while (queue.length > 0) {
    const file = queue.pop() as string
    if (seen.has(file)) continue
    seen.add(file)
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(/\bfrom\s+'([^']+)'|\bimport\s*\(\s*'([^']+)'\s*\)/g)) {
      const resolved = resolveSpecifier(file, match[1] ?? match[2] ?? '')
      if (resolved !== null) queue.push(resolved)
    }
  }
  return [...seen].map((file) => relative(ROOT, file)).sort()
}

const covered = (file: string, paths: readonly string[]): boolean =>
  paths.some((path) => file === path || file.startsWith(`${path}/`))

describe('content-verify workflow', () => {
  it('re-runs when anything the harness imports changes', () => {
    const paths = checkedPaths()
    const imports = harnessImports()
    expect(imports).toContain('lib/domain/settings.ts')
    expect(imports.filter((file) => !covered(file, paths))).toEqual([])
  })

  it('re-runs when the toolchain, dependencies or test setup change', () => {
    const paths = checkedPaths()
    for (const file of [
      'content',
      'package.json',
      'pnpm-lock.yaml',
      'pnpm-workspace.yaml',
      'tsconfig.json',
      'vitest.config.ts',
      '.nvmrc',
      '.github/workflows/content-verify.yml',
    ]) {
      expect(covered(file, paths), file).toBe(true)
    }
  })

  it('guards every step after the path check (fix 17)', () => {
    expect(pathsIndex).toBeGreaterThan(0)
    expect(later.filter((step) => step.if !== RUN_IF)).toEqual([])
  })

  it('runs every multi-line script under bash with set -euo pipefail', () => {
    const scripts = later.filter((step) => (step.run ?? '').includes('\n'))
    expect(scripts.length).toBeGreaterThan(3)
    for (const step of scripts) {
      expect(step.shell, step.name).toBe('bash')
      expect(step.run?.startsWith('set -euo pipefail\n'), step.name).toBe(true)
    }
  })

  it('locks the sandbox down before any solution runs, and checks it afterwards', () => {
    const at = (name: string): number => {
      const index = later.findIndex((step) => step.name === name)
      if (index === -1) throw new Error(`no step "${name}"`)
      return index
    }
    const order = [
      'Runner temp off the shared /tmp',
      'Sandbox user without network (OD2)',
      'Sandbox audit: nothing the runner executes is writable by the sandbox user',
      'Sandbox self-test (fail closed)',
      'CLI refuses to run unsandboxed (exit 2)',
      'Harness self-test on fixtures',
      'No sandbox process survived the harness self-test',
      'Verify content',
      'No sandbox process survived content:verify',
    ].map(at)
    expect(order).toEqual([...order].sort((a, b) => a - b))
    const unsandboxed = later[at('CLI refuses to run unsandboxed (exit 2)')]
    expect(JSON.stringify(unsandboxed)).not.toContain('CONTENT_VERIFY_SANDBOX_USER')
  })
})
