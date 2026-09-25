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

type Step = {
  id?: string
  name?: string
  if?: string
  run?: string
  shell?: string
  uses?: string
  env?: Record<string, string>
}
const workflow = parseYaml(readFileSync(WORKFLOW, 'utf8')) as {
  jobs: { 'content-verify': { 'runs-on': string; steps: Step[] } }
}
const job = workflow.jobs['content-verify']
const steps = job.steps
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
      'Runner temp stayed off /tmp',
    ].map(at)
    expect(order).toEqual([...order].sort((a, b) => a - b))
    const unsandboxed = later[at('CLI refuses to run unsandboxed (exit 2)')]
    expect(JSON.stringify(unsandboxed)).not.toContain('CONTENT_VERIFY_SANDBOX_USER')
  })

  const step = (name: string): Step => {
    const found = later.find((candidate) => candidate.name === name)
    if (found === undefined) throw new Error(`no step "${name}"`)
    return found
  }
  const script = (name: string): string => step(name).run ?? ''

  it('pins the runner image (newer images swap /usr/bin tools for sudo-rs / uutils)', () => {
    expect(job['runs-on']).toBe('ubuntu-24.04')
  })

  it('creates a sandbox user with no extra groups, no cron/at, no name-service or snapd sockets', () => {
    const setup = script('Sandbox user without network (OD2)')
    expect(setup).toContain('/etc/cron.deny')
    expect(setup).toContain('/etc/at.deny')
    expect(setup).toContain('id -Gn cvsandbox')
    for (const socketPath of [
      '/run/systemd/resolve',
      '/run/dbus/system_bus_socket',
      '/run/nscd/socket',
      '/run/snapd.socket',
    ]) {
      expect(setup).toContain(socketPath)
    }
    expect(setup).toContain('getfacl -p')
  })

  it('runs the positive-controlled audit as the sandbox user and fails on findings or a broken audit (N1)', () => {
    const audit = script(
      'Sandbox audit: nothing the runner executes is writable by the sandbox user',
    )
    expect(audit).toContain(
      'sudo -n -u cvsandbox -- /usr/bin/python3 -I -B - --user cvsandbox --path "$PATH"',
    )
    expect(audit).toContain('< tools/content-verify/sandbox_audit.py')
    expect(audit).toContain('0) if ! grep -Eq "$clean" <<< "$summary"; then')
    expect(audit).toContain('1) if grep -Eq "$counted" <<< "$summary"; then')
    expect(audit).toMatch(/\*\) echo "::error::/)
    expect(audit).toContain('$SECONDS')
  })

  it('trusts the audit only with its summary line, and runs it with the production defaults (M2)', () => {
    const audit = script(
      'Sandbox audit: nothing the runner executes is writable by the sandbox user',
    )
    // green needs exit 0 AND the clean summary as the last line
    expect(audit).toContain(
      "'^audited [0-9]+ entries under [0-9]+ roots as cvsandbox: 0 findings$'",
    )
    // exit 1 without a summary line means sudo or python never ran: broken, not findings
    expect(audit).toContain(
      "'^audited [0-9]+ entries under [0-9]+ roots as cvsandbox: [0-9]+ findings$'",
    )
    expect(audit).toContain('tail -n 1')
    // the test-only knobs never reach CI
    expect(audit).not.toContain('--assume-trusted')
    expect(audit).not.toContain('--min-entries')
    expect(audit).not.toContain('--max-printed')
    expect(audit).not.toContain('--writable-control')
  })

  it('proves the name-service, D-Bus, docker and snapd sockets refuse the sandbox user (N8)', () => {
    const selfTest = script('Sandbox self-test (fail closed)')
    expect(selfTest).toContain('PermissionError')
    for (const socketPath of [
      '/run/systemd/resolve/io.systemd.Resolve',
      '/run/dbus/system_bus_socket',
      '/var/run/docker.sock',
      '/run/snapd.socket',
    ]) {
      expect(selfTest).toContain(socketPath)
    }
  })

  it('checks the unsandboxed refusal against an empty root, by its message (N2)', () => {
    const canary = script('CLI refuses to run unsandboxed (exit 2)')
    expect(canary).toContain('--root "$RUNNER_TEMP/cv-empty"')
    expect(canary).toContain('refusing to run solutions unsandboxed')
  })

  it('fails the harness self-test when its tests were skipped (N3)', () => {
    const selfTest = step('Harness self-test on fixtures')
    expect(selfTest.env).toEqual({
      CONTENT_VERIFY_INTEGRATION: '1',
      CONTENT_VERIFY_SANDBOX_USER: 'cvsandbox',
    })
    expect(selfTest.run).toContain('--outputFile.json=')
    expect(selfTest.run).toContain('numPassedTests')
    expect(selfTest.run).toContain('numPendingTests')
  })

  it('treats a pgrep error as a failure, not as "no process left" (N4)', () => {
    for (const name of [
      'No sandbox process survived the harness self-test',
      'No sandbox process survived content:verify',
    ]) {
      const check = script(name)
      expect(check).toContain('for flag in -u -U; do')
      expect(check).toContain('/usr/bin/pgrep -a "$flag" cvsandbox || status=$?')
      expect(check).toMatch(/1\) ;;/)
      expect(check).toMatch(/0\) echo "::error::/)
      expect(check).toMatch(/\*\) echo "::error::/)
    }
  })

  it('fails when tsx left a runner-owned directory in /tmp', () => {
    expect(script('Runner temp stayed off /tmp')).toContain("-name 'tsx-*'")
  })
})
