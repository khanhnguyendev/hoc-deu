import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Every component has a COMPONENTS.md entry and a /dev/components entry (platform design §7.7).
 * A component file is components/{ui,patterns}/*.tsx, components/patterns/<name>/index.tsx or
 * features/<x>/components/**\/*.tsx; files beside a pattern's index.tsx are its internals.
 */
const DOCS = 'docs/design/COMPONENTS.md'
const REGISTRY = 'app/dev/components/registry.tsx'

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

const read = (path: string) => (existsSync(path) ? readFileSync(path, 'utf8') : '')
const docFiles = () => [...read(DOCS).matchAll(/\*\*File:\*\* `([^`]+)`/g)].map((m) => m[1] ?? '')
const catalogFiles = () => [...read(REGISTRY).matchAll(/file: '([^']+)'/g)].map((m) => m[1] ?? '')

describe('component catalog (platform design §7.7)', () => {
  it('finds the M1 components', () => {
    expect(componentFiles().length).toBeGreaterThanOrEqual(30)
  })

  it('documents every component in COMPONENTS.md', () => {
    const documented = new Set(docFiles())
    expect(componentFiles().filter((file) => !documented.has(file))).toEqual([])
  })

  it('renders every component at /dev/components', () => {
    const catalogued = new Set(catalogFiles())
    expect(componentFiles().filter((file) => !catalogued.has(file))).toEqual([])
  })

  it('points every entry at a component file', () => {
    const files = new Set(componentFiles())
    expect([...docFiles(), ...catalogFiles()].filter((file) => !files.has(file))).toEqual([])
  })
})
