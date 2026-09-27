/**
 * The files of a backup artifact (task 5.7b, ADR-0005): each dump gzipped then age-encrypted, and
 * the manifest age-encrypted — nothing else. The backup job checks its upload directory with
 * `checkArtifactDir` before uploading (so plaintext can never be uploaded to this public
 * repository, and an empty or missing file fails the job); the restore test checks the download
 * before decrypting it. Only the first bytes of each file are read, and never printed.
 */
import { open, readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'

/** Every file age encrypts (binary format) starts with this line. */
export const AGE_HEADER = 'age-encryption.org/v1\n'

const AUTH_ARTIFACT = 'auth.sql.gz.age'
const ALWAYS = ['manifest.json.age', 'public.sql.gz.age']

/** The artifact's file names, sorted. */
export function artifactFiles(includesAuth: boolean): string[] {
  return (includesAuth ? [AUTH_ARTIFACT, ...ALWAYS] : [...ALWAYS]).sort()
}

/** `required` / `absent`: the backup job knows; `optional`: the restore test reads it from the manifest later. */
export type AuthExpectation = 'required' | 'absent' | 'optional'

/** Problems with an artifact directory, one per file, sorted by file name; empty when it is fine. */
export async function checkArtifactDir(dir: string, auth: AuthExpectation): Promise<string[]> {
  let names: string[]
  try {
    names = (await readdir(dir)).sort()
  } catch {
    return ['the artifact directory does not exist']
  }
  const allowed = new Set(artifactFiles(auth !== 'absent'))
  const required = auth === 'required' ? artifactFiles(true) : artifactFiles(false)
  const problems = new Map<string, string>()
  for (const name of required) if (!names.includes(name)) problems.set(name, 'missing')
  for (const name of names) {
    const path = join(dir, name)
    const info = await stat(path)
    if (!allowed.has(name) || !info.isFile()) problems.set(name, 'unexpected')
    else if (info.size === 0) problems.set(name, 'empty')
    else if (!(await startsWithAgeHeader(path))) problems.set(name, 'not age-encrypted')
  }
  return [...problems.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([name, problem]) => `${name}: ${problem}`)
}

async function startsWithAgeHeader(path: string): Promise<boolean> {
  const handle = await open(path, 'r')
  try {
    const header = Buffer.alloc(AGE_HEADER.length)
    const { bytesRead } = await handle.read(header, 0, header.length, 0)
    return bytesRead === header.length && header.toString('latin1') === AGE_HEADER
  } finally {
    await handle.close()
  }
}
