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
const STRIP = 'Strip write-for-others across the runner'

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
  jobs: {
    'content-verify': { 'runs-on': string; 'timeout-minutes': number; steps: Step[] }
  }
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
      STRIP,
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
  /** A step's commands, one per line: continuation lines joined, indentation trimmed. */
  const commands = (name: string): string[] =>
    script(name)
      .replace(/\s*\\\n\s*/g, ' ')
      .split('\n')
      .map((line) => line.trim())

  it('pins the runner image (newer images swap /usr/bin tools for sudo-rs / uutils)', () => {
    expect(job['runs-on']).toBe('ubuntu-24.04')
  })

  it('times out at 15 minutes (run 2: the strip took 184 s, the whole job about 4 minutes)', () => {
    expect(job['timeout-minutes']).toBe(15)
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

  it('strips write-for-others after the last setup step and before any sandboxed code (CI round 1)', () => {
    const stripAt = steps.findIndex((candidate) => candidate.name === STRIP)
    expect(stripAt).toBeGreaterThan(pathsIndex)
    // Every action and the dependency install come first; nothing is installed afterwards.
    const setup = steps.filter(
      (candidate) =>
        candidate.uses !== undefined || candidate.run === 'pnpm install --frozen-lockfile',
    )
    expect(setup.length).toBeGreaterThan(6)
    expect(setup.filter((candidate) => steps.indexOf(candidate) > stripAt)).toEqual([])
    expect(steps.slice(stripAt).filter((candidate) => candidate.uses !== undefined)).toEqual([])
    // The sandbox user exists (the ownership check needs it); everything that runs as it is later.
    expect(
      steps.findIndex((candidate) => candidate.name === 'Sandbox user without network (OD2)'),
    ).toBeLessThan(stripAt)
    // Any step that names the sandbox user — however it would run as it (sudo, runuser, su, an
    // env var) — other than the one creating it, comes after the strip.
    const naming = steps.filter((candidate) => JSON.stringify(candidate).includes('cvsandbox'))
    expect(naming.map((candidate) => candidate.name)).toEqual([
      'Sandbox user without network (OD2)',
      STRIP,
      'Sandbox audit: nothing the runner executes is writable by the sandbox user',
      'Sandbox self-test (fail closed)',
      'Harness self-test on fixtures',
      'No sandbox process survived the harness self-test',
      'Verify content',
      'No sandbox process survived content:verify',
    ])
    expect(
      naming.filter((candidate) => steps.indexOf(candidate) < stripAt).map((c) => c.name),
    ).toEqual(['Sandbox user without network (OD2)'])
    // No workflow- or job-level `env` could hand the sandbox user to a step before the strip.
    expect(Object.keys(workflow)).not.toContain('env')
    expect(Object.keys(job)).not.toContain('env')
    const strip = step(STRIP)
    expect(strip.if).toBe(RUN_IF)
    expect(strip.shell).toBe('bash')
    expect(strip.run?.startsWith('set -euo pipefail\n')).toBe(true)
  })

  it('walks every local disk filesystem, skipping only the shared temp dirs (CI round 1)', () => {
    const strip = script(STRIP).replace(/\s*\\\n\s*/g, ' ')
    const walk =
      /sudo find \/ -ignore_readdir_race \\\( (.*?) \\\) -prune -o ! \\\( (.*?) \\\) -prune -o /.exec(
        strip,
      )
    if (walk === null) throw new Error('no `sudo find / … -prune -o … -prune -o` walk in the strip')
    const skipped = ['/tmp', '/var/tmp', '/dev/shm', '/proc', '/sys', '/run']
    expect(walk[1]).toBe(skipped.map((path) => `-path ${path}`).join(' -o '))
    const disks = ['ext2', 'ext3', 'ext4', 'xfs', 'btrfs']
    expect(walk[2]).toBe(disks.map((type) => `-fstype ${type}`).join(' -o '))
    // Positive control: / must be one of the walked types, or the strip would change nothing.
    expect(strip).toContain(`disk_types='${disks.join(',')}'`)
    expect(strip).toContain('findmnt -no FSTYPE --target /')
  })

  it('pins the walk and every change as whole lines: nothing can be appended to them (PR A fix pass)', () => {
    const lines = commands(STRIP)
    const skipped = ['/tmp', '/var/tmp', '/dev/shm', '/proc', '/sys', '/run']
    const disks = ['ext2', 'ext3', 'ext4', 'xfs', 'btrfs']
    expect(lines).toContain(
      [
        'sudo find / -ignore_readdir_race',
        `\\( ${skipped.map((path) => `-path ${path}`).join(' -o ')} \\) -prune -o`,
        `! \\( ${disks.map((type) => `-fstype ${type}`).join(' -o ')} \\) -prune -o`,
        '\\( \\( ! -type l -perm -0002 -fprint0 "$out/others-write" \\) ,',
        '\\( -type d -perm -0001 ! -perm -0004 -fprint0 "$out/search-only" \\) ,',
        '\\( \\( -user cvsandbox -o -group cvsandbox \\) -fprint "$out/owned" \\) ,',
        '\\( -path /usr/bin -fprint "$out/control" \\) \\)',
      ].join(' '),
    )
    for (const line of [
      'sudo xargs -0 -r chmod o-w -- < "$out/others-write"',
      'sudo xargs -0 -r chmod o-x -- < "$out/search-only"',
      'sudo find /opt/hostedtoolcache -type d -exec setfacl -k -- {} +',
    ]) {
      expect(lines).toContain(line)
    }
    // Nothing in the strip or the audit swallows a failure.
    for (const name of [
      STRIP,
      'Sandbox audit: nothing the runner executes is writable by the sandbox user',
    ]) {
      expect(script(name), name).not.toMatch(/\|\|\s*(true|:)(\s|$)|set \+e/)
    }
    expect(script(STRIP)).not.toContain('||')
  })

  it('fails unless the walk reached /usr/bin, / is a walked type and so is every audited dir (PR A fix pass)', () => {
    const strip = script(STRIP)
    const fails = (condition: string) =>
      new RegExp(`${condition}; then\\n\\s+echo "::error::[^\\n]+"\\n\\s+exit 1\\n\\s*fi`)
    // The walk printed /usr/bin: it really walked /.
    expect(strip).toMatch(fails(String.raw`if \[ ! -s "\$out/control" \]`))
    // / is one of the walked types.
    expect(strip).toMatch(fails(String.raw`if \[\[ ",\$disk_types," != \*",\$root_type,"\* \]\]`))
    // Every audited root and PATH dir sits on a walked filesystem.
    expect(strip).toContain('for dir in /opt /usr/local /home /etc "${existing[@]}"; do')
    expect(strip).toContain('dir_type="$(findmnt -no FSTYPE --target "$dir")"')
    expect(strip).toMatch(fails(String.raw`if \[\[ ",\$disk_types," != \*",\$dir_type,"\* \]\]`))
    // The mounts it does not walk are logged.
    expect(strip).toContain('findmnt -lno TARGET,FSTYPE,SOURCE -t "no$disk_types"')
  })

  it('removes the tool cache’s default ACLs and proves none is left (PR A fix pass)', () => {
    const strip = script(STRIP)
    expect(strip).toContain('sudo getfacl -R -s -P -p /opt/hostedtoolcache > "$out/acl-before"')
    expect(strip).toContain('sudo getfacl -R -s -P -p /opt/hostedtoolcache > "$out/acl-after"')
    expect(strip).toMatch(
      /sudo getfacl -R -s -P -p \/opt\/hostedtoolcache > "\$out\/acl-before"[\s\S]*setfacl -k[\s\S]*> "\$out\/acl-after"/,
    )
    expect(strip).toMatch(
      /if \[ "\$left" -ne 0 \]; then\n\s+echo "::error::[^\n]+"\n\s+exit 1\n\s*fi/,
    )
    // The tool-cache Java dirs' ACLs, before and after.
    expect(strip).toContain(
      'sudo getfacl -p /opt/hostedtoolcache "$(dirname "$java_version_dir")" "$java_version_dir"',
    )
  })

  it('"left" is the exact default-ACL awk count over acl-after, feeding the -ne 0 check (M3-R16 m4)', () => {
    const strip = script(STRIP)
    const AWK_PROGRAM = String.raw`awk '/^default:user::/ { n++ } END { print n + 0 }'`
    expect(strip).toContain(`left="$(${AWK_PROGRAM} "$out/acl-after")"`)
    // Immediately followed by the -ne 0 check that fails the job: left drives it, nothing else.
    expect(strip).toContain(`left="$(${AWK_PROGRAM} "$out/acl-after")"\nif [ "$left" -ne 0 ]; then`)
  })

  it('removes write and unlistable search for others, and fails on anything the sandbox owns (CI round 1)', () => {
    const strip = script(STRIP).replace(/\s*\\\n\s*/g, ' ')
    expect(strip).toContain('! -type l -perm -0002 -fprint0 "$out/others-write"')
    expect(strip).toContain('-type d -perm -0001 ! -perm -0004 -fprint0 "$out/search-only"')
    expect(strip).toContain('\\( -user cvsandbox -o -group cvsandbox \\) -fprint "$out/owned"')
    expect(strip).toMatch(/if \[ -s "\$out\/owned" \]; then\s+echo "::error::[\s\S]*?exit 1/)
    expect(strip).toContain('sudo xargs -0 -r chmod o-w -- < "$out/others-write"')
    expect(strip).toContain('sudo xargs -0 -r chmod o-x -- < "$out/search-only"')
    // How many entries changed, and how long it took.
    expect(strip).toContain('$SECONDS')
    expect(strip).toMatch(/echo "Removed write-for-others from \$written entries/)
  })

  it('keeps the audit as strict: same roots, run on the whole PATH (CI round 1)', () => {
    const audit = script(
      'Sandbox audit: nothing the runner executes is writable by the sandbox user',
    ).replace(/\s*\\\n\s*/g, ' ')
    expect(audit).toContain(
      '--user cvsandbox --path "$PATH" /opt /usr/local /home /etc) < tools/content-verify/sandbox_audit.py',
    )
  })

  it('leaves no per-tree chmod, and never grants anything to others (CI round 1)', () => {
    const chmods = later
      .flatMap((candidate) => (candidate.run ?? '').split('\n'))
      .filter((line) => !line.trim().startsWith('#') && /\bchmod\b/.test(line))
    expect(chmods.length).toBe(2)
    for (const line of chmods) expect(line).toMatch(/\bchmod o-[wx] -- /)
    expect(script('Sandbox user without network (OD2)')).not.toContain('chmod')
  })

  it('records the tool cache layout and one Java binary before and after the strip (CI round 1)', () => {
    const strip = script(STRIP)
    expect(strip).toContain('sudo find /opt/hostedtoolcache -maxdepth 3 -type l')
    expect(strip).toContain('namei -l')
    expect(strip).toContain('getfacl -p')
    expect(strip).toMatch(/diagnose_java before\n[\s\S]*sudo find \/ [\s\S]*diagnose_java after\n/)
    expect(strip).toContain('findmnt -lno TARGET,FSTYPE,SOURCE -t "$disk_types"')
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
    // setup-go's `go` matcher turned a passing vitest line into an ##[error] annotation (run 2).
    const lines = commands('Harness self-test on fixtures')
    const removed = lines.indexOf('echo "::remove-matcher owner=go::"')
    expect(removed).toBeGreaterThan(0)
    expect(removed).toBeLessThan(lines.findIndex((line) => line.startsWith('pnpm vitest run')))
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
