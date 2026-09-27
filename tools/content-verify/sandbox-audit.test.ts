/**
 * `sandbox_audit.py` (ADR-0012, review round 2 N1/N7): the workflow runs it AS the sandbox user;
 * here it runs as the developer against a temp tree whose writable spots are known.
 */
import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir, userInfo } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ROOT_SKIP_MESSAGE, runsAsRoot } from './test-support/permissions'

const SCRIPT = join(import.meta.dirname, 'sandbox_audit.py')
const HAS_PYTHON = spawnSync('python3', ['--version']).status === 0

function makeWritable(dir: string): void {
  chmodSync(dir, 0o755)
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) makeWritable(join(dir, entry.name))
  }
}

describe.runIf(HAS_PYTHON)('sandbox_audit.py', () => {
  let base: string
  let root: string
  let open: string
  let mid: string

  beforeEach(() => {
    base = realpathSync(mkdtempSync(join(tmpdir(), 'cv-audit-')))
    root = join(base, 'root')
    open = join(base, 'open') // writable by the auditing user, outside the audited root
    mid = join(base, 'mid')
    mkdirSync(join(root, 'bin'), { recursive: true })
    mkdirSync(open)
    mkdirSync(mid)
    writeFileSync(join(root, 'bin', 'tool'), '#!/bin/sh\n')
    chmodSync(join(root, 'bin', 'tool'), 0o555)
    symlinkSync('tool', join(root, 'bin', 'link-ok'))
    symlinkSync('/dev/null', join(root, 'bin', 'link-dev'))
  })

  afterEach(() => {
    makeWritable(base)
    rmSync(base, { recursive: true, force: true })
  })

  const lockRoot = () => {
    chmodSync(join(root, 'bin'), 0o555)
    chmodSync(root, 0o555)
  }

  const audit = (extra: string[] = [], path = join(root, 'bin')) => {
    const result = spawnSync(
      'python3',
      [
        '-I',
        '-B',
        SCRIPT,
        '--user',
        userInfo().username,
        '--path',
        path,
        '--min-entries',
        '1',
        '--assume-trusted',
        base,
        ...extra,
        root,
      ],
      { encoding: 'utf8' },
    )
    return { status: result.status, lines: result.stdout.trim().split('\n'), stderr: result.stderr }
  }

  // Root ignores every file mode set above (chmodSync 0o555 / 0o000 / …), so none of these cases
  // can observe a real permission denial when the suite runs as root.
  describe.skipIf(runsAsRoot())('permission checks', () => {
    it('passes a tree the user cannot write, with a summary line', () => {
      lockRoot()
      const { status, lines } = audit()
      expect(status).toBe(0)
      expect(lines.at(-1)).toMatch(
        new RegExp(`^audited \\d+ entries under 2 roots as ${userInfo().username}: 0 findings$`),
      )
    })

    it('reports a writable directory once, without descending into it (review M1)', () => {
      mkdirSync(join(root, 'bin', 'open'))
      for (let index = 0; index < 50; index++) {
        writeFileSync(join(root, 'bin', 'open', `file-${index}`), '')
      }
      lockRoot()
      const { status, lines } = audit()
      expect(status).toBe(1)
      expect(lines.filter((line) => line.startsWith('writable:'))).toEqual([
        `writable: ${join(root, 'bin', 'open')}`,
      ])
      expect(lines.at(-1)).toMatch(/: 1 findings$/)
    })

    it('reports a writable file in a directory it cannot write', () => {
      writeFileSync(join(root, 'bin', 'open-file'), '')
      chmodSync(join(root, 'bin', 'open-file'), 0o644)
      lockRoot()
      const { status, lines } = audit()
      expect(status).toBe(1)
      expect(lines).toContain(`writable: ${join(root, 'bin', 'open-file')}`)
    })

    it('caps the printed findings but counts them all, and prints as it goes (review M1)', () => {
      for (const name of ['a', 'b', 'c', 'd']) mkdirSync(join(root, 'bin', name))
      lockRoot()
      const { status, lines } = audit(['--max-printed', '2'])
      expect(status).toBe(1)
      expect(lines.filter((line) => line.startsWith('writable:'))).toHaveLength(2)
      expect(lines.at(-2)).toBe('… 2 more findings not shown')
      expect(lines.at(-1)).toMatch(/: 4 findings$/)
      const source = readFileSync(SCRIPT, 'utf8')
      expect(source).toContain('flush=True')
    })

    it('reports a directory it can enter but not list (review M3)', () => {
      mkdirSync(join(root, 'bin', 'hidden'))
      chmodSync(join(root, 'bin', 'hidden'), 0o111)
      lockRoot()
      const { status, lines } = audit()
      expect(status).toBe(1)
      expect(lines).toContain(
        `searchable but unlistable: ${join(root, 'bin', 'hidden')} (writable paths may hide by name)`,
      )
    })

    it('resolves a hop against the real directory it sits in, not lexically (review M4)', () => {
      const real = join(base, 'real')
      mkdirSync(join(real, 'sub'), { recursive: true })
      writeFileSync(join(real, 'target'), '')
      symlinkSync('../target', join(real, 'sub', 'l2'))
      chmodSync(join(real, 'sub'), 0o555)
      symlinkSync(join(real, 'sub'), join(base, 'alias'))
      symlinkSync(join(base, 'alias', 'l2'), join(root, 'bin', 'through-alias'))
      lockRoot()
      const { status, lines } = audit()
      expect(status).toBe(1)
      // lexically base/alias/../target = base/target (missing, harmless); really real/target
      expect(lines).toContain(
        `link ${join(root, 'bin', 'through-alias')}: target ${join(real, 'target')} is writable`,
      )
    })

    it('follows every symlink hop: a writable hop directory, a writable target, a dangling link', () => {
      writeFileSync(join(open, 'target'), '')
      symlinkSync(join(root, 'bin', 'tool'), join(mid, 'hop'))
      symlinkSync(join(mid, 'hop'), join(root, 'bin', 'two-hops'))
      symlinkSync(join(open, 'target'), join(root, 'bin', 'to-writable'))
      symlinkSync(join(open, 'later'), join(root, 'bin', 'dangling'))
      lockRoot()
      const { status, lines } = audit()
      expect(status).toBe(1)
      expect(lines).toContain(`link ${join(root, 'bin', 'two-hops')}: ${mid} is writable`)
      expect(lines).toContain(
        `link ${join(root, 'bin', 'to-writable')}: target ${join(open, 'target')} is writable`,
      )
      expect(lines).toContain(`link ${join(root, 'bin', 'dangling')}: ${open} is writable`)
      expect(lines.filter((line) => line.includes('link-ok') || line.includes('link-dev'))).toEqual(
        [],
      )
    })

    it('checks the nearest existing parent of a missing PATH directory, and relative entries', () => {
      lockRoot()
      const { status, lines } = audit(
        [],
        [join(root, 'bin'), join(open, 'not-yet', 'bin'), join(root, 'missing'), '.'].join(':'),
      )
      expect(status).toBe(1)
      expect(lines).toContain(
        `PATH ${join(open, 'not-yet', 'bin')}: missing, and ${open} is writable`,
      )
      expect(lines).toContain('PATH entry "." is relative')
      expect(lines.filter((line) => line.includes(join(root, 'missing')))).toEqual([])
    })

    it('fails as broken (exit 2) when a positive control fails', () => {
      lockRoot()
      const wrongUser = spawnSync(
        'python3',
        ['-I', '-B', SCRIPT, '--user', 'nobody-else', '--path', '', '--min-entries', '1', root],
        { encoding: 'utf8' },
      )
      expect(wrongUser.status).toBe(2)
      expect(wrongUser.stderr).toMatch(/runs as .* not nobody-else/)

      const control = audit(['--writable-control', join(root, 'bin')])
      expect(control.status).toBe(2)
      expect(control.stderr).toMatch(/positive control: .* is not writable/)

      const tooFew = audit(['--min-entries', '100000'])
      expect(tooFew.status).toBe(2)
      expect(tooFew.stderr).toMatch(/walked only \d+ entries/)
    })

    it('treats an unreadable directory as unreachable, not as an error', () => {
      mkdirSync(join(root, 'bin', 'closed'))
      chmodSync(join(root, 'bin', 'closed'), 0o000)
      lockRoot()
      const { status } = audit()
      expect(status).toBe(0)
      expect(statSync(join(root, 'bin', 'closed')).mode & 0o777).toBe(0)
    })
  })

  it.runIf(runsAsRoot())(ROOT_SKIP_MESSAGE, () => {
    expect(runsAsRoot()).toBe(true)
  })
})
