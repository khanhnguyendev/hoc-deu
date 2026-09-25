/**
 * The generated import maps at request time (final review M5): `content:build` emits the ok fixture,
 * and the emitted `.generated/{catalog,mdx,code}.ts` are imported and read through
 * `createCatalogAccess` exactly as `lib/content/catalog.ts` binds them — so PR A itself exercises
 * `loadMdx` and `loadCode` for real keys (vitest compiles `.mdx` with the shared remark plugins,
 * like `@next/mdx`).
 */
import { cpSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  createCatalogAccess,
  type CatalogAccess,
  type CodeLoaders,
  type MdxLoaders,
} from '@/lib/content/catalog-access'
import type { Catalog } from '@/lib/content/catalog-types'
import { MDX_COMPONENT_NAMES } from '@/lib/content/mdx-components'
import { buildContent } from './build'

const OK = path.join(import.meta.dirname, '__fixtures__', 'content', 'ok')

/** Every content component as a plain wrapper: this test is about loading, not the components. */
const stubs = Object.fromEntries(
  MDX_COMPONENT_NAMES.map((name) => [
    name,
    (props: { children?: ReactNode }) => createElement('div', null, props.children),
  ]),
)

let root: string
let access: CatalogAccess

beforeAll(async () => {
  root = mkdtempSync(path.join(tmpdir(), 'runtime-maps-'))
  cpSync(OK, path.join(root, 'content'), { recursive: true })
  const result = await buildContent({ repoRoot: root, check: false })
  expect(result.issues).toEqual([])
  const generated = path.join(root, '.generated')
  const [{ CATALOG }, { MDX_LOADERS }, { CODE_LOADERS }] = (await Promise.all([
    import(path.join(generated, 'catalog.ts')),
    import(path.join(generated, 'mdx.ts')),
    import(path.join(generated, 'code.ts')),
  ])) as [{ CATALOG: Catalog }, { MDX_LOADERS: MdxLoaders }, { CODE_LOADERS: CodeLoaders }]
  access = createCatalogAccess(CATALOG, { mdx: MDX_LOADERS, code: CODE_LOADERS })
}, 60_000)

afterAll(() => {
  if (root !== undefined) rmSync(root, { recursive: true, force: true })
})

describe('the emitted import maps, through createCatalogAccess (final review M5)', () => {
  it('loadMdx renders a lesson and a note by their real keys', async () => {
    const lesson = await access.loadMdx('dsa:lesson-two-pointers')
    expect(lesson).toBeTypeOf('function')
    const lessonHtml = renderToStaticMarkup(createElement(lesson!, { components: stubs }))
    expect(lessonHtml).toContain('Khi nào nghĩ tới hai con trỏ')
    expect(lessonHtml).not.toContain('format: pattern')

    const note = await access.loadMdx('dsa:lc-0001#note')
    const noteHtml = renderToStaticMarkup(createElement(note!, { components: stubs }))
    expect(noteHtml).toContain('Ý tưởng chính')
  })

  it('loadMdx is null for an unknown key and never reads the prototype', async () => {
    expect(await access.loadMdx('dsa:lesson-missing')).toBeNull()
    expect(await access.loadMdx('toString')).toBeNull()
  })

  it('loadCode returns the highlighted bundle of an item', async () => {
    const bundle = await access.loadCode('dsa:lc-0001')
    expect(Object.keys(bundle?.solutions ?? {})).toEqual(['python', 'java', 'go'])
    const lesson = await access.loadCode('dsa:lesson-two-pointers')
    expect(Object.values(lesson?.blocks ?? {}).map((block) => block.lang)).toEqual(['python'])
    expect(await access.loadCode('dsa:lc-9999')).toBeNull()
  })

  it('the catalog is the emitted one', () => {
    expect(access.getItem('dsa:lc-0001')?.type).toBe('problem')
    expect(access.catalog.tracks.map((track) => track.id)).toEqual(['dsa', 'english'])
  })
})
