import { readdirSync, readFileSync } from 'node:fs'
import { join, sep } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isBranchingScanned, itemTypeBranches } from './item-type-branching'

const SWITCH_ON_TYPE = `export function label(item: { type: string }) {
  switch (item.type) {
    case 'problem':
      return 'Bài'
    default:
      return item.type
  }
}`

describe('itemTypeBranches (§7.2: no switch/case on item types, gate-review fix 4)', () => {
  it('flags a case on an item type in a feature and in a page, naming the file and line', () => {
    const feature = itemTypeBranches('features/roadmap/x.ts', SWITCH_ON_TYPE)
    expect(feature).toHaveLength(1)
    expect(feature[0]).toMatch(/^features\/roadmap\/x\.ts:3: case 'problem'/)
    expect(itemTypeBranches('app/x/page.tsx', SWITCH_ON_TYPE)).toHaveLength(1)
  })

  it('flags every item type, in any quoting, parenthesised or not', () => {
    const source = `switch (t) {
  case "flashcard":
  case \`lesson\`:
  case ('exercise'):
  case 'prompt': {
    break
  }
}`
    expect(itemTypeBranches('components/patterns/x.tsx', source)).toHaveLength(4)
  })

  it('does not flag a case on something else, such as a template block kind', () => {
    const source = `switch (block.kind) {
  case 'review':
  case 'new':
    break
}`
    expect(itemTypeBranches('features/roadmap/x.ts', source)).toEqual([])
  })

  it('does not flag equality checks (narrow with isItemOfType instead)', () => {
    const source = `if (item.type === 'lesson') console.log(1)
const isProblem = item.type == 'problem' ? 1 : 0`
    expect(itemTypeBranches('features/roadmap/x.ts', source)).toEqual([])
  })

  it.each([
    'features/items/registry.ts',
    'features/items/problem/Page.tsx',
    'lib/content/item-types/index.ts',
    'lib/content/catalog-access.ts',
    'tools/content/load.ts',
  ])('exempts %s (the registry and the content pipeline build items by type)', (file) => {
    expect(itemTypeBranches(file, SWITCH_ON_TYPE)).toEqual([])
  })

  it.each(['features/roadmap/view-model.test.ts', 'app/x/page.test.tsx'])(
    'skips the test file %s',
    (file) => {
      expect(itemTypeBranches(file, SWITCH_ON_TYPE)).toEqual([])
    },
  )

  it.each([
    'lib/domain/plan/x.ts',
    'lib/events/x.ts',
    'tools/guards/x.ts',
    'components/ui/x.tsx',
    'app/(app)/t/[trackId]/page.tsx',
  ])('scans %s', (file) => {
    expect(isBranchingScanned(file)).toBe(true)
    expect(itemTypeBranches(file, SWITCH_ON_TYPE)).toHaveLength(1)
  })
})

describe('the real source tree', () => {
  it('has no switch/case on item types outside the registry and the content pipeline', () => {
    const root = process.cwd()
    const violations: string[] = []
    let scanned = 0
    for (const dir of ['app', 'components', 'features', 'lib', 'tools']) {
      const entries = readdirSync(join(root, dir), { recursive: true, encoding: 'utf8' })
      for (const entry of entries) {
        if (!/\.[cm]?[jt]sx?$/.test(entry) || entry.split(sep).includes('node_modules')) continue
        const file = `${dir}/${entry.split(sep).join('/')}`
        if (!isBranchingScanned(file)) continue
        violations.push(...itemTypeBranches(file, readFileSync(join(root, file), 'utf8')))
        scanned += 1
      }
    }
    expect(scanned).toBeGreaterThan(100)
    expect(violations).toEqual([])
  })
})
