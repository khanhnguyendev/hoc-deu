import { describe, expect, it } from 'vitest'
import type { Catalog, CatalogItem } from './catalog-types'
import { NOTE_SUFFIX, publishTarget, targetStatus } from './publish-targets'

const problem = (id: string, status: 'active' | 'draft', note: 'active' | 'draft' | null) =>
  ({
    id,
    type: 'problem',
    trackId: 'dsa',
    status,
    content: { note: note === null ? null : { status: note, mdxKey: `${id}#note` } },
  }) as unknown as CatalogItem
const lesson = (id: string, status: 'active' | 'draft' | 'retired') =>
  ({ id, type: 'lesson', trackId: 'dsa', status, content: {} }) as unknown as CatalogItem

const CATALOG = {
  items: Object.fromEntries(
    [
      problem('dsa:lc-0001', 'active', 'active'),
      problem('dsa:lc-0206', 'active', 'draft'),
      problem('dsa:lc-0146', 'draft', null),
      lesson('dsa:lesson-trees', 'draft'),
      lesson('dsa:lesson-old', 'retired'),
    ].map((item) => [item.id, item]),
  ),
} as unknown as Catalog

describe('publish targets (§6.6: an item ID, or <itemId>#note)', () => {
  it('builds a target', () => {
    expect(publishTarget('dsa:lc-0206', 'note')).toBe('dsa:lc-0206#note')
    expect(publishTarget('dsa:lc-0146', 'item')).toBe('dsa:lc-0146')
    expect(NOTE_SUFFIX).toBe('#note')
  })

  it('reads a target’s status from the catalog: the item’s, or its note’s', () => {
    expect(targetStatus(CATALOG, 'dsa:lc-0001')).toBe('active')
    expect(targetStatus(CATALOG, 'dsa:lc-0001#note')).toBe('active')
    expect(targetStatus(CATALOG, 'dsa:lc-0206#note')).toBe('draft')
    expect(targetStatus(CATALOG, 'dsa:lc-0146')).toBe('draft')
    expect(targetStatus(CATALOG, 'dsa:lesson-trees')).toBe('draft')
    expect(targetStatus(CATALOG, 'dsa:lesson-old')).toBe('retired')
  })

  it('an unknown item, a problem without a note or a note of a non-problem → null', () => {
    expect(targetStatus(CATALOG, 'dsa:lc-9999')).toBeNull()
    expect(targetStatus(CATALOG, 'dsa:lc-0146#note')).toBeNull()
    expect(targetStatus(CATALOG, 'dsa:lesson-trees#note')).toBeNull()
    expect(targetStatus(CATALOG, 'constructor')).toBeNull()
    expect(targetStatus(CATALOG, '__proto__#note')).toBeNull()
  })
})
