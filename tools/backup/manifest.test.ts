import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { scanDump, type DumpScan } from './dump'
import { buildManifest, parseManifest, verifyBackupDir, type ManifestInput } from './manifest'
import { AUTH_DUMP, AUTH_ROWS, COMMIT, PUBLIC_DUMP, PUBLIC_ROWS } from './test-support'

const root = mkdtempSync(join(tmpdir(), 'backup-manifest-test-'))
afterAll(() => rmSync(root, { recursive: true, force: true }))

let dirCount = 0
function backupDir(files: Record<string, string>): string {
  const dir = join(root, `backup-${++dirCount}`)
  mkdirSync(dir)
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text)
  return dir
}

async function scans(withAuth: boolean): Promise<ManifestInput['scans']> {
  const dir = backupDir(
    withAuth ? { 'public.sql': PUBLIC_DUMP, 'auth.sql': AUTH_DUMP } : { 'public.sql': PUBLIC_DUMP },
  )
  const publicScan = await scanDump(join(dir, 'public.sql'))
  return withAuth
    ? { 'public.sql': publicScan, 'auth.sql': await scanDump(join(dir, 'auth.sql')) }
    : { 'public.sql': publicScan }
}

async function input(withAuth = true): Promise<ManifestInput> {
  return {
    commit: COMMIT,
    takenAt: '2026-09-27T22:00:04Z',
    kind: 'weekly',
    includesAuth: withAuth,
    pgDump: 'pg_dump (PostgreSQL) 17.6 (Ubuntu 17.6-1.pgdg24.04+1)',
    server: '17.4',
    counts: withAuth ? { ...PUBLIC_ROWS, ...AUTH_ROWS } : { ...PUBLIC_ROWS },
    scans: await scans(withAuth),
  }
}

describe('buildManifest', () => {
  it('records the commit, the counts and each dump’s SHA-256 and size', async () => {
    const given = await input()
    const manifest = buildManifest(given)
    expect(manifest).toEqual({
      format: 1,
      commit: COMMIT,
      takenAt: '2026-09-27T22:00:04Z',
      kind: 'weekly',
      includesAuth: true,
      pgDump: 'pg_dump (PostgreSQL) 17.6 (Ubuntu 17.6-1.pgdg24.04+1)',
      server: '17.4',
      files: {
        'public.sql': {
          sha256: given.scans['public.sql'].sha256,
          bytes: given.scans['public.sql'].bytes,
        },
        'auth.sql': {
          sha256: (given.scans['auth.sql'] as DumpScan).sha256,
          bytes: (given.scans['auth.sql'] as DumpScan).bytes,
        },
      },
      counts: {
        'auth.identities': 2,
        'auth.users': 2,
        'public.ops_metrics': 0,
        'public.profiles': 4,
      },
    })
    expect(parseManifest(JSON.stringify(manifest))).toEqual(manifest)
  })

  it('builds a public-only manifest (BACKUP_INCLUDE_AUTH=false, ADR-0029)', async () => {
    const manifest = buildManifest(await input(false))
    expect(manifest.includesAuth).toBe(false)
    expect(Object.keys(manifest.files)).toEqual(['public.sql'])
    expect(Object.keys(manifest.counts)).toEqual(['public.ops_metrics', 'public.profiles'])
  })

  it('refuses when a database count differs from the rows in the dump (not one snapshot)', async () => {
    const given = await input()
    const build = () =>
      buildManifest({ ...given, counts: { ...given.counts, 'public.profiles': 5 } })
    expect(build).toThrow(/public\.profiles: the row count in the dump differs from the database/)
  })

  it('refuses when a counted table is not in the dump, or a dumped table was not counted', async () => {
    const given = await input()
    expect(() =>
      buildManifest({ ...given, counts: { ...given.counts, 'public.events': 0 } }),
    ).toThrow(/public\.events: in the database, missing from the dump/)
    const fewer = Object.fromEntries(
      Object.entries(given.counts).filter(([table]) => table !== 'public.ops_metrics'),
    )
    expect(() => buildManifest({ ...given, counts: fewer })).toThrow(
      /public\.ops_metrics: in the dump, not in the database/,
    )
  })

  it('refuses an auth dump the manifest does not declare, and a missing one it does', async () => {
    const withAuth = await input(true)
    const withoutAuth = await input(false)
    expect(() => buildManifest({ ...withAuth, includesAuth: false })).toThrow(/auth/)
    expect(() => buildManifest({ ...withoutAuth, includesAuth: true })).toThrow(/auth/)
  })

  it('refuses a dump holding tables of the other file’s schema', async () => {
    const given = await input()
    const swapped = {
      'public.sql': given.scans['auth.sql'] as DumpScan,
      'auth.sql': given.scans['public.sql'],
    }
    expect(() => buildManifest({ ...given, scans: swapped })).toThrow(/public\.sql.*auth\./)
  })

  it('refuses an auth dump without both auth.users and auth.identities', async () => {
    const given = await input()
    const authScan = given.scans['auth.sql'] as DumpScan
    const usersOnly = { ...authScan, rows: { 'auth.users': 2 } }
    expect(() =>
      buildManifest({
        ...given,
        counts: { ...PUBLIC_ROWS, 'auth.users': 2 },
        scans: { ...given.scans, 'auth.sql': usersOnly },
      }),
    ).toThrow(/auth\.identities/)
  })
})

describe('parseManifest', () => {
  async function valid(): Promise<Record<string, unknown>> {
    return JSON.parse(JSON.stringify(buildManifest(await input()))) as Record<string, unknown>
  }

  it('rejects an extra key, at the top level and inside a file entry', async () => {
    const manifest = await valid()
    expect(() => parseManifest(JSON.stringify({ ...manifest, rows: [] }))).toThrow(/rows/)
    const files = manifest.files as Record<string, Record<string, unknown>>
    const withExtra = {
      ...manifest,
      files: { ...files, 'public.sql': { ...files['public.sql'], path: '/tmp/x' } },
    }
    expect(() => parseManifest(JSON.stringify(withExtra))).toThrow(/path/)
    const extraFile = { ...manifest, files: { ...files, 'notes.txt': files['public.sql'] } }
    expect(() => parseManifest(JSON.stringify(extraFile))).toThrow(/notes\.txt/)
  })

  type Json = Record<string, unknown>
  const withPublicEntry = (manifest: Json, entry: Json): Json => {
    const files = manifest.files as Record<string, Json>
    return { ...manifest, files: { ...files, 'public.sql': { ...files['public.sql'], ...entry } } }
  }

  it.each<[string, (manifest: Json) => Json]>([
    ['a short commit', (m) => ({ ...m, commit: '9bf847e' })],
    ['an upper-case SHA-256', (m) => withPublicEntry(m, { sha256: 'A'.repeat(64) })],
    ['a fractional size', (m) => withPublicEntry(m, { bytes: 1.5 })],
    ['another format', (m) => ({ ...m, format: 2 })],
    ['an unknown kind', (m) => ({ ...m, kind: 'hourly' })],
    ['a takenAt that is not a UTC timestamp', (m) => ({ ...m, takenAt: 'yesterday' })],
    [
      'a negative count',
      (m) => ({ ...m, counts: { ...(m.counts as Json), 'public.profiles': -1 } }),
    ],
    ['a quoted table name', (m) => ({ ...m, counts: { ...(m.counts as Json), 'public."P"': 1 } })],
    [
      'a table of another schema',
      (m) => ({ ...m, counts: { ...(m.counts as Json), 'storage.objects': 1 } }),
    ],
    ['no public table', (m) => ({ ...m, counts: { 'auth.users': 2, 'auth.identities': 2 } })],
    ['auth counts and file without includesAuth', (m) => ({ ...m, includesAuth: false })],
    ['a control character in a version string', (m) => ({ ...m, server: '17.4\u0000' })],
  ])('rejects %s', async (_label, change) => {
    const manifest = await valid()
    expect(() => parseManifest(JSON.stringify(manifest))).not.toThrow()
    expect(() => parseManifest(JSON.stringify(change(manifest)))).toThrow()
  })

  it('rejects text that is not JSON without echoing it', () => {
    let message = ''
    try {
      parseManifest('{"commit": "someone@example.test"')
    } catch (error) {
      message = String(error)
    }
    expect(message).toMatch(/not JSON/)
    expect(message).not.toContain('someone')
  })
})

describe('verifyBackupDir (the restore test, after decrypting)', () => {
  async function manifestText(withAuth = true): Promise<string> {
    return JSON.stringify(buildManifest(await input(withAuth)))
  }

  it('returns the manifest when every file matches its SHA-256 and row counts', async () => {
    const dir = backupDir({
      'manifest.json': await manifestText(),
      'public.sql': PUBLIC_DUMP,
      'auth.sql': AUTH_DUMP,
    })
    const manifest = await verifyBackupDir(dir)
    expect(manifest.commit).toBe(COMMIT)
    expect(manifest.includesAuth).toBe(true)
  })

  it('accepts a public-only backup', async () => {
    const dir = backupDir({ 'manifest.json': await manifestText(false), 'public.sql': PUBLIC_DUMP })
    expect((await verifyBackupDir(dir)).includesAuth).toBe(false)
  })

  it('rejects a file whose SHA-256 differs', async () => {
    // Same rows, one changed character: only the checksum can tell.
    const dir = backupDir({
      'manifest.json': await manifestText(),
      'public.sql': PUBLIC_DUMP.replace('Quản trị viên', 'Quản trị viêN'),
      'auth.sql': AUTH_DUMP,
    })
    await expect(verifyBackupDir(dir)).rejects.toThrow(/public\.sql.*SHA-256/)
  })

  it('rejects a missing file and an unexpected one', async () => {
    const missing = backupDir({ 'manifest.json': await manifestText(), 'public.sql': PUBLIC_DUMP })
    await expect(verifyBackupDir(missing)).rejects.toThrow(/auth\.sql.*missing/)
    const extra = backupDir({
      'manifest.json': await manifestText(false),
      'public.sql': PUBLIC_DUMP,
      'auth.sql': AUTH_DUMP,
    })
    await expect(verifyBackupDir(extra)).rejects.toThrow(/auth\.sql.*not in the manifest/)
  })

  it('rejects a dump whose rows disagree with the manifest’s counts', async () => {
    const manifest = buildManifest(await input())
    const edited = { ...manifest, counts: { ...manifest.counts, 'auth.users': 3 } }
    const dir = backupDir({
      'manifest.json': JSON.stringify(edited),
      'public.sql': PUBLIC_DUMP,
      'auth.sql': AUTH_DUMP,
    })
    await expect(verifyBackupDir(dir)).rejects.toThrow(/auth\.users/)
  })

  it('rejects a dump with a psql meta-command before anything loads it', async () => {
    // A forged backup: the manifest carries the tampered file's own checksum.
    const tampered = `${PUBLIC_DUMP}\\! id\n`
    const manifest = buildManifest(await input())
    const forged = { ...manifest, files: { ...manifest.files, 'public.sql': fileEntry(tampered) } }
    const dir = backupDir({
      'manifest.json': JSON.stringify(forged),
      'public.sql': tampered,
      'auth.sql': AUTH_DUMP,
    })
    await expect(verifyBackupDir(dir)).rejects.toThrow(/meta-command/)
  })

  it('rejects a directory without a manifest', async () => {
    const dir = backupDir({ 'public.sql': PUBLIC_DUMP })
    await expect(verifyBackupDir(dir)).rejects.toThrow(/manifest\.json/)
  })
})

/** The SHA-256 and size of a text, as the manifest records a file (bypassing scanDump's checks). */
function fileEntry(text: string): { sha256: string; bytes: number } {
  return { sha256: createHash('sha256').update(text).digest('hex'), bytes: Buffer.byteLength(text) }
}
