import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { REPOSITORY, REPOSITORY_URL } from './repository'

describe('lib/ops/repository.ts', () => {
  it('names the one public repository, as owner/name and as its web URL', () => {
    expect(REPOSITORY).toBe('khanhnguyendev/hoc-deu')
    expect(REPOSITORY_URL).toBe('https://github.com/khanhnguyendev/hoc-deu')
  })

  it('is not server-only: the admin view model (also rendered by the client catalog) imports it', () => {
    expect(readFileSync('lib/ops/repository.ts', 'utf8')).not.toMatch(
      /import\s+['"]server-only['"]/,
    )
    expect(readFileSync('lib/ops/repository.ts', 'utf8')).not.toMatch(/^import /m)
  })

  it.each(['lib/ops/github.ts', 'features/admin/overview.ts'])(
    '%s imports it instead of spelling the repository out',
    (file) => {
      const source = readFileSync(file, 'utf8')
      expect(source).toContain("from '@/lib/ops/repository'")
      expect(source).not.toContain("'khanhnguyendev/hoc-deu'")
      expect(source).not.toContain("'https://github.com/khanhnguyendev/hoc-deu'")
    },
  )
})
