import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { AGE_HEADER } from './artifact'
import { main } from './main'
import { parseManifest } from './manifest'
import { AUTH_DUMP, AUTH_ROWS, COMMIT, PUBLIC_DUMP, PUBLIC_ROWS } from './test-support'

const root = mkdtempSync(join(tmpdir(), 'backup-main-test-'))
afterAll(() => rmSync(root, { recursive: true, force: true }))

let dirCount = 0
function dir(files: Record<string, string>): string {
  const path = join(root, `dir-${++dirCount}`)
  mkdirSync(path)
  for (const [name, text] of Object.entries(files)) writeFileSync(join(path, name), text)
  return path
}

const tsv = (counts: Record<string, number>): string =>
  Object.entries(counts)
    .map(([table, count]) => `${table}\t${count}\n`)
    .join('')

async function run(argv: string[]): Promise<{ code: number; out: string; err: string }> {
  const out: string[] = []
  const err: string[] = []
  const code = await main(argv, {
    out: (line) => out.push(line),
    err: (line) => err.push(line),
  })
  return { code, out: out.join('\n'), err: err.join('\n') }
}

const manifestArgs = (work: string, withAuth: 'true' | 'false', counts = 'counts.tsv') => [
  'manifest',
  '--work',
  work,
  '--counts',
  join(work, counts),
  '--commit',
  COMMIT,
  '--kind',
  'daily',
  '--taken-at',
  '2026-09-26T22:00:03Z',
  '--pg-dump',
  'pg_dump (PostgreSQL) 17.6',
  '--server',
  '17.4',
  '--with-auth',
  withAuth,
]

function backupWork(withAuth: boolean, counts?: Record<string, number>): string {
  return dir({
    'public.sql': PUBLIC_DUMP,
    ...(withAuth ? { 'auth.sql': AUTH_DUMP } : {}),
    'counts.tsv': tsv(counts ?? (withAuth ? { ...PUBLIC_ROWS, ...AUTH_ROWS } : PUBLIC_ROWS)),
  })
}

describe('main manifest (the backup job)', () => {
  it('writes manifest.json (mode 0600) from the dumps and the snapshot’s counts', async () => {
    const work = backupWork(true)
    const result = await run(manifestArgs(work, 'true'))
    expect(result).toMatchObject({ code: 0, err: '' })
    expect(result.out).toBe('manifest.json: 4 tables in 2 files')
    const path = join(work, 'manifest.json')
    expect(statSync(path).mode & 0o077).toBe(0)
    const manifest = parseManifest(readFileSync(path, 'utf8'))
    expect(manifest).toMatchObject({ commit: COMMIT, kind: 'daily', includesAuth: true })
    expect(manifest.counts).toEqual({ ...PUBLIC_ROWS, ...AUTH_ROWS })
  })

  it('writes a public-only manifest when auth is off', async () => {
    const work = backupWork(false)
    const result = await run(manifestArgs(work, 'false'))
    expect(result.code).toBe(0)
    expect(parseManifest(readFileSync(join(work, 'manifest.json'), 'utf8')).includesAuth).toBe(
      false,
    )
  })

  it('fails when the counts disagree with the dumps, naming the table but no numbers', async () => {
    const work = backupWork(true, { ...PUBLIC_ROWS, ...AUTH_ROWS, 'public.profiles': 5 })
    const result = await run(manifestArgs(work, 'true'))
    expect(result.code).toBe(1)
    expect(result.err).toContain('public.profiles')
    expect(result.err).not.toMatch(/\b[45]\b/)
  })

  it('fails when auth is on but auth.sql is missing', async () => {
    const work = backupWork(false, { ...PUBLIC_ROWS, ...AUTH_ROWS })
    expect((await run(manifestArgs(work, 'true'))).code).toBe(1)
  })

  it.each([
    [
      'a missing option',
      (args: string[]) => args.filter((arg) => arg !== '--commit' && arg !== COMMIT),
    ],
    ['an unknown kind', (args: string[]) => args.map((arg) => (arg === 'daily' ? 'monthly' : arg))],
    ['a --with-auth other than true or false', (args: string[]) => [...args.slice(0, -1), 'yes']],
    ['an unknown option', (args: string[]) => [...args, '--force']],
  ])('exits 2 on %s', async (_label, change) => {
    const work = backupWork(true)
    expect((await run(change(manifestArgs(work, 'true')))).code).toBe(2)
  })
})

describe('main check-artifact (before the upload, and after the download)', () => {
  const encrypted = `${AGE_HEADER}-> X25519 x\nbody`

  it('passes on the expected encrypted files', async () => {
    const path = dir({
      'manifest.json.age': encrypted,
      'public.sql.gz.age': encrypted,
      'auth.sql.gz.age': encrypted,
    })
    const result = await run(['check-artifact', '--dir', path, '--auth', 'required'])
    expect(result).toMatchObject({ code: 0, out: '3 encrypted files, none empty' })
  })

  it('fails and lists every problem', async () => {
    const path = dir({ 'manifest.json.age': encrypted, 'public.sql': 'COPY' })
    const result = await run(['check-artifact', '--dir', path, '--auth', 'absent'])
    expect(result.code).toBe(1)
    expect(result.err).toContain('public.sql.gz.age: missing')
    expect(result.err).toContain('public.sql: unexpected')
  })

  it('exits 2 on an unknown --auth', async () => {
    const path = dir({})
    expect((await run(['check-artifact', '--dir', path, '--auth', 'maybe'])).code).toBe(2)
  })
})

describe('main verify (the restore test, after decrypting)', () => {
  it('prints the manifest’s commit, auth flag, kind and time as GitHub step outputs', async () => {
    const work = backupWork(true)
    expect((await run(manifestArgs(work, 'true'))).code).toBe(0)
    const plain = dir({
      'manifest.json': readFileSync(join(work, 'manifest.json'), 'utf8'),
      'public.sql': PUBLIC_DUMP,
      'auth.sql': AUTH_DUMP,
    })
    const result = await run(['verify', '--dir', plain])
    expect(result).toEqual({
      code: 0,
      out: [
        `commit=${COMMIT}`,
        'includes_auth=true',
        'kind=daily',
        'taken_at=2026-09-26T22:00:03Z',
      ].join('\n'),
      err: '',
    })
  })

  it('fails on a changed file', async () => {
    const work = backupWork(true)
    await run(manifestArgs(work, 'true'))
    const plain = dir({
      'manifest.json': readFileSync(join(work, 'manifest.json'), 'utf8'),
      'public.sql': `${PUBLIC_DUMP}-- changed\n`,
      'auth.sql': AUTH_DUMP,
    })
    const result = await run(['verify', '--dir', plain])
    expect(result.code).toBe(1)
    expect(result.out).toBe('')
    expect(result.err).toMatch(/public\.sql/)
  })
})

describe('main compare (the restore test, after loading)', () => {
  async function manifestPath(): Promise<string> {
    const work = backupWork(true)
    await run(manifestArgs(work, 'true'))
    return join(work, 'manifest.json')
  }

  it('passes when the restored counts equal the manifest’s', async () => {
    const counts = join(
      dir({ 'restored.tsv': tsv({ ...AUTH_ROWS, ...PUBLIC_ROWS }) }),
      'restored.tsv',
    )
    const result = await run(['compare', '--manifest', await manifestPath(), '--counts', counts])
    expect(result).toEqual({ code: 0, out: 'row counts match the manifest for 4 tables', err: '' })
  })

  it('fails on a missing table and a different count, naming tables but no numbers', async () => {
    const counts = join(
      dir({ 'restored.tsv': tsv({ ...AUTH_ROWS, 'public.profiles': 3 }) }),
      'restored.tsv',
    )
    const result = await run(['compare', '--manifest', await manifestPath(), '--counts', counts])
    expect(result.code).toBe(1)
    expect(result.err).toContain(
      'public.ops_metrics: in the manifest, missing from the restored database',
    )
    expect(result.err).toContain(
      'public.profiles: the row count in the restored database differs from the manifest',
    )
    expect(result.err).not.toMatch(/\b[34]\b/)
  })
})

describe('main usage', () => {
  it('exits 2 without a command or with an unknown one', async () => {
    expect((await run([])).code).toBe(2)
    expect((await run(['restore'])).code).toBe(2)
  })
})
