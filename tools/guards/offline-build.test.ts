import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/** The build must work offline (platform design §2.1, §6.8): fonts are self-hosted. */
const SOURCE_DIRS = ['app', 'components', 'features', 'lib']
const SOURCE = /\.(?:[cm]?[jt]sx?|css)$/
// Split so this file does not match itself.
const BANNED = ['next/font/' + 'google', 'fonts.' + 'googleapis.com', 'fonts.' + 'gstatic.com']
const FONTS = 'app/fonts'

function files(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return files(path)
    return SOURCE.test(name) ? [path] : []
  })
}

describe('offline build (platform design §2.1)', () => {
  it('never loads fonts from Google', () => {
    const hits = SOURCE_DIRS.flatMap(files).flatMap((file) => {
      const text = readFileSync(file, 'utf8')
      return BANNED.filter((needle) => text.includes(needle)).map((needle) => `${file}: ${needle}`)
    })
    expect(hits).toEqual([])
  })

  it('ships every font file the loaders reference, as woff2', () => {
    const loaders = readFileSync(join(FONTS, 'fonts.ts'), 'utf8')
    const paths = [...loaders.matchAll(/path: '\.\/([^']+)'/g)].map((m) => join(FONTS, m[1] ?? ''))
    expect(paths).toHaveLength(5)
    for (const path of paths) {
      expect(readFileSync(path).subarray(0, 4).toString('latin1'), path).toBe('wOF2')
    }
  })

  it('ships the OFL license next to every font family', () => {
    const families = readdirSync(FONTS).filter((d) => statSync(join(FONTS, d)).isDirectory())
    expect(families.sort()).toEqual(['be-vietnam-pro', 'jetbrains-mono'])
    for (const family of families) {
      expect(readFileSync(join(FONTS, family, 'OFL.txt'), 'utf8')).toContain(
        'SIL Open Font License',
      )
    }
  })
})
