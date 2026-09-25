import { describe, expect, expectTypeOf, it } from 'vitest'
import type { CatalogItem, ProblemContent } from '@/lib/content/catalog-types'
import { cardItem, problemItem } from './fixtures'
import { isItemOfType } from './narrow'

describe('isItemOfType (gate-review fix 4)', () => {
  it('is true for the item’s own type and false for any other', () => {
    const problem: CatalogItem = problemItem()
    expect(isItemOfType(problem, 'problem')).toBe(true)
    expect(isItemOfType(problem, 'lesson')).toBe(false)
    expect(isItemOfType(cardItem(), 'flashcard')).toBe(true)
    expect(isItemOfType(cardItem(), 'problem')).toBe(false)
  })

  it('narrows the item, and so its content, to the type', () => {
    const item: CatalogItem = problemItem()
    if (isItemOfType(item, 'problem')) {
      expectTypeOf(item).toEqualTypeOf<CatalogItem<'problem'>>()
      expectTypeOf(item.content).toEqualTypeOf<ProblemContent>()
      expect(item.content.leetcode).toBe(1)
    } else {
      expect.unreachable()
    }
  })
})
