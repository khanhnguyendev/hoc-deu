/**
 * A backup's manifest (task 5.7b, ADR-0029): which commit's migrations describe the dumped data,
 * when the snapshot was taken, the row count of every table and each dump file's SHA-256 and size.
 * No personal data — and it is encrypted with the dumps anyway.
 *
 * The backup job builds it (`buildManifest`) from the counts it took inside the dumps' snapshot and
 * from a scan of the dump files, and refuses when the two disagree: the counts then describe
 * exactly the dump. The restore test checks a decrypted artifact against it (`verifyBackupDir`)
 * before loading anything, then compares the restored database's counts with it.
 *
 * `format` is 1. A later format must keep reading 1: the restore test runs this file from `main`
 * against the newest backup, which an older commit may have written.
 */
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'
import { AUTH_TABLES, TABLE_NAME, compareCounts, describeDifferences, type Counts } from './counts'
import { scanDump, type DumpScan } from './dump'

export const MANIFEST_FILE = 'manifest.json'
export const PUBLIC_FILE = 'public.sql'
export const AUTH_FILE = 'auth.sql'

const fileEntrySchema = z.strictObject({
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  bytes: z.number().int().nonnegative(),
})
const versionSchema = z.string().regex(/^[\x20-\x7e]{1,200}$/)

export const manifestSchema = z
  .strictObject({
    format: z.literal(1),
    /** The commit the backup job ran at: the restore applies its migrations. */
    commit: z.string().regex(/^[0-9a-f]{40}$/),
    /** The snapshot's time (the dumps' transaction start), UTC. */
    takenAt: z.iso.datetime(),
    kind: z.enum(['daily', 'weekly']),
    /** Whether auth.users and auth.identities are in the backup (BACKUP_INCLUDE_AUTH). */
    includesAuth: z.boolean(),
    /** `pg_dump --version`. */
    pgDump: versionSchema,
    /** The server's `server_version`. */
    server: versionSchema,
    files: z.strictObject({
      [PUBLIC_FILE]: fileEntrySchema,
      [AUTH_FILE]: fileEntrySchema.optional(),
    }),
    counts: z.record(z.string().regex(TABLE_NAME), z.number().int().nonnegative()),
  })
  .superRefine((manifest, context) => {
    const tables = Object.keys(manifest.counts)
    const authTables = tables.filter((table) => table.startsWith('auth.')).sort()
    if (!tables.some((table) => table.startsWith('public.'))) {
      context.addIssue({ code: 'custom', path: ['counts'], message: 'no public table' })
    }
    const expectedAuth = manifest.includesAuth ? [...AUTH_TABLES] : []
    if (authTables.join() !== expectedAuth.join()) {
      context.addIssue({
        code: 'custom',
        path: ['counts'],
        message: `the auth tables must be exactly ${expectedAuth.join(', ') || 'none'}`,
      })
    }
    if ((manifest.files[AUTH_FILE] !== undefined) !== manifest.includesAuth) {
      context.addIssue({
        code: 'custom',
        path: ['files', AUTH_FILE],
        message: `${AUTH_FILE} must be listed exactly when includesAuth is true`,
      })
    }
  })

export type Manifest = z.infer<typeof manifestSchema>

export type ManifestInput = Omit<Manifest, 'format' | 'files' | 'counts'> & {
  /** The counts counts.sql printed inside the dumps' snapshot. */
  counts: Counts
  scans: { [PUBLIC_FILE]: DumpScan; [AUTH_FILE]?: DumpScan }
}

/** Which schema's tables each dump file may hold. */
const SCHEMA_OF: Record<string, string> = { [PUBLIC_FILE]: 'public.', [AUTH_FILE]: 'auth.' }

/** Builds the manifest, refusing when the database's counts and the dumps' rows disagree. */
export function buildManifest(input: ManifestInput): Manifest {
  const { scans, counts, ...rest } = input
  const authScan = scans[AUTH_FILE]
  if ((authScan !== undefined) !== input.includesAuth) {
    throw new Error(
      input.includesAuth
        ? `manifest: auth is included but there is no ${AUTH_FILE}`
        : `manifest: auth is not included but there is an ${AUTH_FILE}`,
    )
  }
  const dumped: Record<string, number> = {}
  for (const [file, scan] of Object.entries(scans)) {
    const schema = SCHEMA_OF[file] as string
    const foreign = Object.keys(scan.rows).filter((table) => !table.startsWith(schema))
    if (foreign.length > 0) {
      throw new Error(`manifest: ${file} holds tables of another schema: ${foreign.join(', ')}`)
    }
    Object.assign(dumped, scan.rows)
  }
  if (authScan !== undefined) {
    const missing = AUTH_TABLES.filter((table) => !Object.hasOwn(authScan.rows, table))
    if (missing.length > 0) {
      throw new Error(`manifest: ${AUTH_FILE} does not hold ${missing.join(', ')}`)
    }
  }
  const differences = compareCounts(counts, dumped)
  if (differences.length > 0) {
    throw new Error(
      `manifest: the dump and the database's counts disagree:\n${describeDifferences(differences, {
        expected: 'the database',
        actual: 'the dump',
      })}`,
    )
  }
  const files: Manifest['files'] = { [PUBLIC_FILE]: fileEntry(scans[PUBLIC_FILE]) }
  if (authScan !== undefined) files[AUTH_FILE] = fileEntry(authScan)
  const sortedCounts = Object.fromEntries(
    Object.entries(counts).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  )
  return manifestSchema.parse({ format: 1, ...rest, files, counts: sortedCounts })
}

function fileEntry(scan: DumpScan): { sha256: string; bytes: number } {
  return { sha256: scan.sha256, bytes: scan.bytes }
}

/** Parses manifest.json strictly (unknown keys are errors). Never echoes the text. */
export function parseManifest(text: string): Manifest {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error('manifest: not JSON')
  }
  const parsed = manifestSchema.safeParse(json)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => {
      const keys = issue.code === 'unrecognized_keys' ? ` (${issue.keys.join(', ')})` : ''
      return `${issue.path.join('.') || '(root)'}: ${issue.code}${keys}`
    })
    throw new Error(`manifest: invalid — ${issues.join('; ')}`)
  }
  return parsed.data
}

/**
 * Checks a decrypted, decompressed backup directory against its manifest: exactly manifest.json
 * and the listed dump files, each with its SHA-256 and size, each file's rows equal to the
 * manifest's counts, and no psql meta-command in any of them (scanDump). Returns the manifest.
 */
export async function verifyBackupDir(dir: string): Promise<Manifest> {
  const names = (await readdir(dir)).sort()
  if (!names.includes(MANIFEST_FILE)) throw new Error(`backup: ${MANIFEST_FILE} is missing`)
  const manifest = parseManifest(await readFile(join(dir, MANIFEST_FILE), 'utf8'))
  const listed = Object.keys(manifest.files)
  const problems = [
    ...listed.filter((file) => !names.includes(file)).map((file) => `${file}: missing`),
    ...names
      .filter((name) => name !== MANIFEST_FILE && !listed.includes(name))
      .map((name) => `${name}: not in the manifest`),
  ]
  if (problems.length > 0) throw new Error(`backup: ${problems.join('; ')}`)

  const dumped: Record<string, number> = {}
  for (const file of listed) {
    const scan = await scanDump(join(dir, file))
    const entry = manifest.files[file as keyof Manifest['files']]
    if (entry === undefined || scan.sha256 !== entry.sha256 || scan.bytes !== entry.bytes) {
      throw new Error(`backup: ${file} does not match its SHA-256 in the manifest`)
    }
    Object.assign(dumped, scan.rows)
  }
  const differences = compareCounts(manifest.counts, dumped)
  if (differences.length > 0) {
    throw new Error(
      `backup: the dump files disagree with the manifest's counts:\n${describeDifferences(
        differences,
        { expected: 'the manifest', actual: 'the dump files' },
      )}`,
    )
  }
  return manifest
}
