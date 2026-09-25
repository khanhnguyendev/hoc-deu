import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { Catalog } from '@/lib/content/catalog-types'
import type { CodeBundle } from '@/lib/content/code-tokens'
import { emitGenerated, type EmitInput } from './emit'

const temps: string[] = []
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function tempRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'content-emit-'))
  temps.push(root)
  return root
}

const CATALOG: Catalog = {
  schemaVersion: 1,
  tracks: [],
  roadmaps: {},
  missingRoadmaps: [],
  decks: {},
  items: {},
  coverage: {},
}

const BUNDLE: CodeBundle = {
  solutions: { python: { lang: 'python', lines: [[['def', 'keyword'], ' f(): ...']] } },
  blocks: { 'text:0000abcd': { lang: 'text', lines: [['x']] } },
}

function input(root: string, overrides: Partial<EmitInput> = {}): EmitInput {
  return {
    repoRoot: root,
    outDir: path.join(root, '.generated'),
    catalog: CATALOG,
    mdx: {
      'dsa:lesson-two-pointers': path.join(root, 'content/tracks/dsa/lessons/two-pointers.mdx'),
      'dsa:lc-0001#note': path.join(root, 'content/tracks/dsa/problems/lc-0001-two-sum/note.mdx'),
    },
    code: { 'dsa:lc-0001': BUNDLE, 'dsa:lesson-two-pointers': { solutions: {}, blocks: {} } },
    ...overrides,
  }
}

/** Every file under `dir` (relative, `/`-separated) → its text. */
function snapshot(dir: string): Record<string, string> {
  const files: Record<string, string> = {}
  for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue
    const file = path.join(entry.parentPath, entry.name)
    files[path.relative(dir, file).split(path.sep).join('/')] = readFileSync(file, 'utf8')
  }
  return files
}

describe('emitGenerated', () => {
  it('writes the catalog (JSON and TS), the MDX map, the code map and one bundle per item', () => {
    const root = tempRoot()
    const written = emitGenerated(input(root))
    expect(written).toEqual([
      'catalog.json',
      'catalog.ts',
      'code.ts',
      'code/dsa/lc-0001.ts',
      'code/dsa/lesson-two-pointers.ts',
      'mdx.ts',
    ])
    expect(Object.keys(snapshot(path.join(root, '.generated'))).sort()).toEqual(written)
    const catalogJson = readFileSync(path.join(root, '.generated/catalog.json'), 'utf8')
    expect(catalogJson).toBe(`${JSON.stringify(CATALOG, null, 2)}\n`)
  })

  it('catalog.ts holds no object literal: the catalog is one JSON.parse of a string', () => {
    const root = tempRoot()
    emitGenerated(input(root))
    const source = readFileSync(path.join(root, '.generated/catalog.ts'), 'utf8')
    expect(source).toContain("import type { Catalog } from '../lib/content/catalog-types'")
    const line = source.split('\n').find((text) => text.startsWith('export const CATALOG'))
    expect(line).toBe(
      `export const CATALOG: Catalog = JSON.parse(${JSON.stringify(JSON.stringify(CATALOG))})`,
    )
    // Outside its one string literal, the CATALOG line has no braces: no object literal.
    expect(line?.replace(/"(?:[^"\\]|\\.)*"/g, '""')).toBe(
      'export const CATALOG: Catalog = JSON.parse("")',
    )
    // The only braces outside string literals are the type import's.
    const outsideStrings = source
      .split('\n')
      .map((text) => text.replace(/"(?:[^"\\]|\\.)*"/g, '""'))
    expect(outsideStrings.filter((text) => text.includes('{'))).toEqual([
      "import type { Catalog } from '../lib/content/catalog-types'",
    ])
  })

  it('mdx.ts starts with the mdx types reference and maps each key to its file, relative', () => {
    const root = tempRoot()
    emitGenerated(input(root))
    const source = readFileSync(path.join(root, '.generated/mdx.ts'), 'utf8')
    expect(source.split('\n')[0]).toBe('/// <reference types="mdx" />')
    expect(source).toContain("import type { MDXContent } from 'mdx/types'")
    expect(source).toContain(
      'export const MDX_LOADERS: Readonly<Record<string, () => Promise<{ default: MDXContent }>>> = {',
    )
    expect(source).toContain(
      '  "dsa:lc-0001#note": () => import("../content/tracks/dsa/problems/lc-0001-two-sum/note.mdx"),',
    )
    expect(source).toContain(
      '  "dsa:lesson-two-pointers": () => import("../content/tracks/dsa/lessons/two-pointers.mdx"),',
    )
    // Keys are sorted.
    expect(source.indexOf('"dsa:lc-0001#note"')).toBeLessThan(
      source.indexOf('"dsa:lesson-two-pointers"'),
    )
  })

  it('an empty MDX map is {}', () => {
    const root = tempRoot()
    emitGenerated(input(root, { mdx: {}, code: {} }))
    const mdx = readFileSync(path.join(root, '.generated/mdx.ts'), 'utf8')
    expect(mdx).toContain('MDXContent }>>> = {}\n')
    const code = readFileSync(path.join(root, '.generated/code.ts'), 'utf8')
    expect(code).toContain(
      'export const CODE_LOADERS = {} satisfies Record<string, () => Promise<{ default: CodeBundle }>>',
    )
  })

  it('writes each code bundle as JSON.parse of a string and maps item IDs to their module', () => {
    const root = tempRoot()
    emitGenerated(input(root))
    const bundle = readFileSync(path.join(root, '.generated/code/dsa/lc-0001.ts'), 'utf8')
    expect(bundle).toContain("import type { CodeBundle } from '../../../lib/content/code-tokens'")
    expect(bundle).toContain(
      `const bundle: CodeBundle = JSON.parse(${JSON.stringify(JSON.stringify(BUNDLE))})`,
    )
    expect(bundle).toContain('export default bundle')

    const code = readFileSync(path.join(root, '.generated/code.ts'), 'utf8')
    expect(code).toContain("import type { CodeBundle } from '../lib/content/code-tokens'")
    expect(code).toContain('  "dsa:lc-0001": () => import("./code/dsa/lc-0001"),')
    expect(code).toContain('} satisfies Record<string, () => Promise<{ default: CodeBundle }>>')
  })

  it('removes stale code bundles and empty folders', () => {
    const root = tempRoot()
    const stale = path.join(root, '.generated/code/old-track')
    mkdirSync(stale, { recursive: true })
    writeFileSync(path.join(stale, 'lc-0009.ts'), 'export default {}\n')
    writeFileSync(path.join(root, '.generated/code/stale.ts'), 'export default {}\n')
    mkdirSync(path.join(root, '.generated/code/dsa'), { recursive: true })
    writeFileSync(path.join(root, '.generated/code/dsa/lc-0002.ts'), 'export default {}\n')

    emitGenerated(input(root))
    expect(existsSync(stale)).toBe(false)
    expect(existsSync(path.join(root, '.generated/code/stale.ts'))).toBe(false)
    expect(existsSync(path.join(root, '.generated/code/dsa/lc-0002.ts'))).toBe(false)
    expect(existsSync(path.join(root, '.generated/code/dsa/lc-0001.ts'))).toBe(true)
  })

  it('two runs produce byte-identical output', () => {
    const root = tempRoot()
    emitGenerated(input(root))
    const first = snapshot(path.join(root, '.generated'))
    // The same content given in another key order.
    const reversed = input(root)
    emitGenerated({
      ...reversed,
      mdx: Object.fromEntries(Object.entries(reversed.mdx).reverse()),
      code: Object.fromEntries(Object.entries(reversed.code).reverse()),
    })
    expect(snapshot(path.join(root, '.generated'))).toEqual(first)
  })
})
