import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ItemRowProps, ItemType } from '@/features/items/types'
import type { CatalogItem } from '@/lib/content/catalog-types'
import type { ReviewEntry } from './view-model'

const fixtures = vi.hoisted(() => ({ items: {} as Record<string, CatalogItem> }))

/** A stand-in registry: each type's Row prints what it received (as `today/rows.test.tsx`). */
vi.mock('@/features/items/registry', () => ({
  getItemType: (type: string) => ({
    Row: function FakeRow({ item, mode, href, showStatus }: ItemRowProps<ItemType>) {
      return (
        <a
          href={href}
          data-row={type}
          data-mode={mode ?? 'none'}
          data-show-status={String(showStatus ?? false)}
        >
          {item.title}
        </a>
      )
    },
  }),
}))
vi.mock('@/lib/content/catalog', () => ({
  getItem: (id: string) => fixtures.items[id] ?? null,
}))

const { cardItem, problemItem } = await import('@/features/items/fixtures')
const { reviewRows } = await import('./rows')

const PROBLEM = problemItem()
const CARD = cardItem()
fixtures.items = { [PROBLEM.id]: PROBLEM, [CARD.id]: CARD }

function entry(patch: Partial<ReviewEntry> & Pick<ReviewEntry, 'itemId'>): ReviewEntry {
  return {
    trackId: 'dsa',
    mode: 'recall',
    minutes: 5,
    weak: false,
    overdueDays: 0,
    href: '/x',
    ...patch,
  }
}

describe('reviewRows (task 5.3)', () => {
  it("renders each non-flashcard entry's Row with its mode and href, no built-in status pill", () => {
    const slots = reviewRows([
      entry({ itemId: PROBLEM.id, mode: 'redo', href: '/t/dsa/items/lc-0001?mode=redo' }),
    ])
    expect(slots).toHaveLength(1)
    render(<div>{slots[0]!.row}</div>)
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/t/dsa/items/lc-0001?mode=redo')
    expect(link.dataset).toMatchObject({ row: 'problem', mode: 'redo', showStatus: 'false' })
  })

  it('carries the entry’s `weak` flag alongside the row', () => {
    const slots = reviewRows([entry({ itemId: PROBLEM.id, weak: true })])
    expect(slots[0]!.weak).toBe(true)
  })

  it('excludes flashcard entries (the card session shows those)', () => {
    expect(reviewRows([entry({ itemId: CARD.id })])).toEqual([])
  })

  it('excludes an item the catalog no longer lists', () => {
    expect(reviewRows([entry({ itemId: 'dsa:gone' })])).toEqual([])
  })
})
