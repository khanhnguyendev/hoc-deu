import { describe, expect, it, vi } from 'vitest'
import type { ItemRowProps, ItemType } from '@/features/items/types'
import type { CatalogItem } from '@/lib/content/catalog-types'
import type { ReviewEntry } from './view-model'

const fixtures = vi.hoisted(() => ({ items: {} as Record<string, CatalogItem> }))
const calls = vi.hoisted(() => [] as unknown[][])

vi.mock('@/lib/content/catalog', () => ({
  getItem: (id: string) => fixtures.items[id] ?? null,
}))
/** A stand-in `renderItemRow`: records what it received and returns a token ReactNode. */
vi.mock('@/features/items/render', () => ({
  renderItemRow: (
    item: CatalogItem,
    props: Omit<ItemRowProps<ItemType>, 'item' | 'href'> & { href: string },
  ) => {
    calls.push([item.id, props])
    return `row:${item.id}`
  },
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

describe('reviewRows (task 5.3 review, findings M4/M5)', () => {
  it('renders each non-flashcard entry through renderItemRow, with its mode, href and showNoteHint', () => {
    calls.length = 0
    const slots = reviewRows([
      entry({ itemId: PROBLEM.id, mode: 'redo', href: '/t/dsa/items/lc-0001?mode=redo' }),
    ])
    expect(slots).toEqual([{ itemId: PROBLEM.id, row: `row:${PROBLEM.id}` }])
    expect(calls).toEqual([
      [
        PROBLEM.id,
        {
          state: null,
          mode: 'redo',
          href: '/t/dsa/items/lc-0001?mode=redo',
          showStatus: false,
          showNoteHint: true,
        },
      ],
    ])
  })

  it('a Weak entry passes a `weak` state and showStatus true (the "Yếu" pill inside the link)', () => {
    calls.length = 0
    reviewRows([entry({ itemId: PROBLEM.id, weak: true })])
    expect(calls[0]![1]).toMatchObject({
      state: { status: 'weak' },
      showStatus: true,
    })
  })

  it('excludes flashcard entries (the card session shows those)', () => {
    expect(reviewRows([entry({ itemId: CARD.id })])).toEqual([])
  })

  it('excludes an item the catalog no longer lists', () => {
    expect(reviewRows([entry({ itemId: 'dsa:gone' })])).toEqual([])
  })
})
