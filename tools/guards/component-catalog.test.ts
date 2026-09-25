import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ITEM_TYPES } from '@/lib/content/schemas/common'

/**
 * Every component has a COMPONENTS.md entry and a /dev/components entry (platform design §7.7).
 * A component file is components/{ui,patterns}/*.tsx, components/patterns/<name>/index.tsx or
 * features/<x>/components/**\/*.tsx; files beside a pattern's index.tsx are its internals.
 *
 * Item types (task 3.4a): each `features/items/<type>/{Page,Row}.tsx` has a COMPONENTS.md entry
 * and appears in the /dev/items gallery (`app/dev/items/page.tsx`) instead — they are server
 * components that read the catalog, so the client catalog registry cannot render them.
 */
const DOCS = 'docs/design/COMPONENTS.md'
const REGISTRY = 'app/dev/components/registry.tsx'
const ITEMS_GALLERY = 'app/dev/items/page.tsx'

const isComponent = (name: string) => name.endsWith('.tsx') && !name.endsWith('.test.tsx')
const list = (dir: string) => (existsSync(dir) ? readdirSync(dir) : [])

function walk(dir: string): string[] {
  return list(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : isComponent(name) ? [path] : []
  })
}

function componentFiles(): string[] {
  const flat = ['components/ui', 'components/patterns'].flatMap((dir) =>
    list(dir)
      .filter(isComponent)
      .map((name) => `${dir}/${name}`),
  )
  const folders = list('components/patterns')
    .map((name) => `components/patterns/${name}/index.tsx`)
    .filter((path) => existsSync(path))
  const features = list('features').flatMap((feature) => walk(`features/${feature}/components`))
  return [...flat, ...folders, ...features].sort()
}

/** `features/items/<type>/Page.tsx` and `Row.tsx`, for every folder that has one of them. */
function itemTypeFiles(): string[] {
  return list('features/items')
    .flatMap((name) => ['Page.tsx', 'Row.tsx'].map((file) => `features/items/${name}/${file}`))
    .filter((path) => existsSync(path))
    .sort()
}

const read = (path: string) => (existsSync(path) ? readFileSync(path, 'utf8') : '')
const docFiles = () => [...read(DOCS).matchAll(/\*\*File:\*\* `([^`]+)`/g)].map((m) => m[1] ?? '')
const entryFiles = (path: string) =>
  [...read(path).matchAll(/file: '([^']+)'/g)].map((m) => m[1] ?? '')
const catalogFiles = () => entryFiles(REGISTRY)
const galleryFiles = () => entryFiles(ITEMS_GALLERY)

describe('component catalog (platform design §7.7)', () => {
  it('finds the M1 components', () => {
    expect(componentFiles().length).toBeGreaterThanOrEqual(30)
  })

  it('finds a Page and a Row for every item type', () => {
    expect(itemTypeFiles()).toEqual(
      [...ITEM_TYPES]
        .flatMap((type) => [`features/items/${type}/Page.tsx`, `features/items/${type}/Row.tsx`])
        .sort(),
    )
  })

  it('documents every component and every item-type Page and Row in COMPONENTS.md', () => {
    const documented = new Set(docFiles())
    const files = [...componentFiles(), ...itemTypeFiles()]
    expect(files.filter((file) => !documented.has(file))).toEqual([])
  })

  it('renders every component at /dev/components', () => {
    const catalogued = new Set(catalogFiles())
    expect(componentFiles().filter((file) => !catalogued.has(file))).toEqual([])
  })

  it('renders every item-type Page and Row at /dev/items', () => {
    const shown = new Set(galleryFiles())
    expect(itemTypeFiles().filter((file) => !shown.has(file))).toEqual([])
  })

  it('points every entry at a component file', () => {
    const components = new Set(componentFiles())
    const itemTypes = new Set(itemTypeFiles())
    expect(docFiles().filter((file) => !components.has(file) && !itemTypes.has(file))).toEqual([])
    expect(catalogFiles().filter((file) => !components.has(file))).toEqual([])
    expect(galleryFiles().filter((file) => !itemTypes.has(file))).toEqual([])
  })
})
