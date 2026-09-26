import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { AGE_HEADER, artifactFiles, checkArtifactDir } from './artifact'

const root = mkdtempSync(join(tmpdir(), 'backup-artifact-test-'))
afterAll(() => rmSync(root, { recursive: true, force: true }))

const ENCRYPTED = `${AGE_HEADER}-> X25519 abc\nbody`

let dirCount = 0
function dir(files: Record<string, string>): string {
  const path = join(root, `artifact-${++dirCount}`)
  mkdirSync(path)
  for (const [name, text] of Object.entries(files)) writeFileSync(join(path, name), text)
  return path
}

const ALL = {
  'auth.sql.gz.age': ENCRYPTED,
  'manifest.json.age': ENCRYPTED,
  'public.sql.gz.age': ENCRYPTED,
}
/** A copy of `files` without `name`. */
const without = (files: Record<string, string>, name: string): Record<string, string> =>
  Object.fromEntries(Object.entries(files).filter(([key]) => key !== name))
const PUBLIC_ONLY = without(ALL, 'auth.sql.gz.age')

describe('artifactFiles', () => {
  it('lists the encrypted files of a backup artifact', () => {
    expect(artifactFiles(true)).toEqual([
      'auth.sql.gz.age',
      'manifest.json.age',
      'public.sql.gz.age',
    ])
    expect(artifactFiles(false)).toEqual(['manifest.json.age', 'public.sql.gz.age'])
  })
})

describe('checkArtifactDir', () => {
  it('accepts exactly the expected age-encrypted, non-empty files', async () => {
    expect(await checkArtifactDir(dir(ALL), 'required')).toEqual([])
    expect(await checkArtifactDir(dir(PUBLIC_ONLY), 'absent')).toEqual([])
    expect(await checkArtifactDir(dir(ALL), 'optional')).toEqual([])
    expect(await checkArtifactDir(dir(PUBLIC_ONLY), 'optional')).toEqual([])
  })

  it('reports a missing file', async () => {
    expect(await checkArtifactDir(dir(PUBLIC_ONLY), 'required')).toEqual([
      'auth.sql.gz.age: missing',
    ])
    const noManifest = without(ALL, 'manifest.json.age')
    expect(await checkArtifactDir(dir(noManifest), 'optional')).toEqual([
      'manifest.json.age: missing',
    ])
  })

  it('reports an auth file the backup should not hold', async () => {
    expect(await checkArtifactDir(dir(ALL), 'absent')).toEqual(['auth.sql.gz.age: unexpected'])
  })

  it('reports an empty file and a file that is not age-encrypted, without reading it out', async () => {
    const problems = await checkArtifactDir(
      dir({ ...ALL, 'public.sql.gz.age': '', 'manifest.json.age': '{"commit":"someone"}' }),
      'required',
    )
    expect(problems).toEqual(['manifest.json.age: not age-encrypted', 'public.sql.gz.age: empty'])
  })

  it('reports plaintext and any other file or directory', async () => {
    const path = dir({ ...ALL, 'public.sql': 'COPY …', 'public.sql.gz': 'x' })
    mkdirSync(join(path, 'nested'))
    expect(await checkArtifactDir(path, 'required')).toEqual([
      'nested: unexpected',
      'public.sql: unexpected',
      'public.sql.gz: unexpected',
    ])
  })

  it('reports a missing directory', async () => {
    expect(await checkArtifactDir(join(root, 'nowhere'), 'required')).toEqual([
      'the artifact directory does not exist',
    ])
  })
})
