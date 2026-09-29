import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const CONTRACT_DIR = join(process.cwd(), 'lib/bot/contract')

/** Every module specifier a file imports or re-exports (static `import` / `export … from`). */
function specifiers(source: string): string[] {
  const found: string[] = []
  const pattern = /(?:^|\n)\s*(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]/g
  for (const match of source.matchAll(pattern)) found.push(match[1] as string)
  for (const match of source.matchAll(/(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g)) {
    found.push(match[1] as string)
  }
  return found
}

/** The contract runs in the server and in M7's `pnpm bot` CLI (Part B-M6 decision 3). */
const allowed = (specifier: string) =>
  specifier === 'zod' || specifier.startsWith('@/lib/domain/') || specifier.startsWith('./')

describe('lib/bot/contract imports only zod, lib/domain and its siblings', () => {
  it('reads import and re-export specifiers', () => {
    expect(
      specifiers("import { z } from 'zod'\nexport * from './runs'\nimport 'server-only'\n"),
    ).toEqual(['zod', './runs', 'server-only'])
    expect(allowed('server-only')).toBe(false)
    expect(allowed('@/lib/supabase/admin')).toBe(false)
    expect(allowed('@/lib/domain/events')).toBe(true)
  })

  it('holds for every contract file', () => {
    const files = readdirSync(CONTRACT_DIR).filter((file) => file.endsWith('.ts'))
    expect(files).toContain('index.ts')
    for (const file of files) {
      const source = readFileSync(join(CONTRACT_DIR, file), 'utf8')
      const bad = specifiers(source).filter((specifier) => !allowed(specifier))
      expect(bad, file).toEqual([])
    }
  })
})
