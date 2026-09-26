import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ItemRowProps, ItemType } from '@/features/items/types'
import type { CatalogItem } from '@/lib/content/catalog-types'
import type { ItemState } from '@/lib/domain/state'
import { block, blockView, storedPlan, TODAY, todayData, todayPage } from './__tests__/fixtures'

const fixtures = vi.hoisted(() => ({ items: {} as Record<string, CatalogItem> }))

/** A stand-in registry: each type's Row prints what it received. */
vi.mock('@/features/items/registry', () => ({
  getItemType: (type: string) => ({
    Row: function FakeRow({ item, state, mode, href, showStatus }: ItemRowProps<ItemType>) {
      return (
        <a
          href={href}
          data-row={type}
          data-state={state?.status ?? 'none'}
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

const { cardItem, problemItem, NOTE } = await import('@/features/items/fixtures')
const { todaySlots } = await import('./rows')

const NOTED = problemItem()
const NO_NOTE = problemItem({
  id: 'dsa:lc-0002',
  localId: 'lc-0002',
  title: 'Add Two Numbers',
  content: { note: null },
})
const DRAFT_NOTE = problemItem({
  id: 'dsa:lc-0003',
  localId: 'lc-0003',
  title: 'Longest Substring Without Repeating Characters',
  content: { note: { ...NOTE, status: 'draft' } },
})
const CARD = cardItem()
const NO_EXAMPLE = cardItem({
  id: 'english:w01-sync',
  localId: 'w01-sync',
  title: 'sync',
  content: { front: 'sync', example: undefined },
})
fixtures.items = Object.fromEntries(
  [NOTED, NO_NOTE, DRAFT_NOTE, CARD, NO_EXAMPLE].map((item) => [item.id, item]),
)

const STATE: ItemState = {
  itemId: NOTED.id,
  trackId: 'dsa',
  topicId: 'arrays-hashing',
  itemType: 'problem',
  level: 2,
  weak: true,
  topSuccesses: 0,
  status: 'weak',
  dueOn: TODAY,
  lastResult: 'failed',
  lastResultOn: '2026-09-25',
  introducedOn: '2026-09-20',
  lapses: 1,
  reps: 2,
}

const REVIEW = `${TODAY}:dsa:review:1`
const SHADOWING = `${TODAY}:english:practice:2`

const page = todayPage(
  { kind: 'plan', plan: storedPlan(), blocks: {} },
  {
    blocks: [
      blockView({
        block: block(REVIEW, { kind: 'review', trackId: 'dsa' }),
        items: [
          { itemId: NOTED.id, mode: 'recall', href: '/t/dsa/items/lc-0001?block=r&mode=recall' },
          { itemId: NO_NOTE.id, mode: 'redo', href: '/t/dsa/items/lc-0002?block=r&mode=redo' },
          { itemId: DRAFT_NOTE.id, mode: 'recall', href: '/x' },
          { itemId: 'dsa:lc-9999', mode: 'recall', href: '/gone' },
        ],
      }),
      blockView({
        block: block(SHADOWING, {
          kind: 'practice',
          trackId: 'english',
          tag: 'shadowing',
          shadowing: [CARD.id, NO_EXAMPLE.id, NOTED.id, 'english:gone'],
        }),
      }),
    ],
  },
)
const withState = { ...page, data: todayData(page.data.state, { items: { [NOTED.id]: STATE } }) }

describe('todaySlots (rows through the registry, task 5.1b)', () => {
  const slots = todaySlots(withState)

  it("renders each known item's Row with its state, mode and the block's href", () => {
    render(<div>{slots[REVIEW]!.items.map((slot) => slot.row)}</div>)
    const [noted, noNote, draft] = screen.getAllByRole('link')
    expect(screen.getAllByRole('link')).toHaveLength(3)
    expect(noted!.getAttribute('href')).toBe('/t/dsa/items/lc-0001?block=r&mode=recall')
    expect(noted!.dataset).toMatchObject({
      row: 'problem',
      state: 'weak',
      mode: 'recall',
      showStatus: 'true',
    })
    expect(noNote!.dataset).toMatchObject({ state: 'none', mode: 'redo' })
    expect(draft!.textContent).toBe(DRAFT_NOTE.title)
  })

  it('marks a problem without a note a learner can see (none, or a draft) — RF-4', () => {
    expect(slots[REVIEW]!.items.map((slot) => [slot.itemId, slot.noNote])).toEqual([
      [NOTED.id, false],
      [NO_NOTE.id, true],
      [DRAFT_NOTE.id, true],
    ])
  })

  it("gives a shadowing block its cards' example sentences, and no rows", () => {
    expect(slots[SHADOWING]).toEqual({
      items: [],
      sentences: [{ itemId: CARD.id, text: CARD.content.example }],
    })
  })

  it('has one entry per block, sentences empty for a block without shadowing cards', () => {
    expect(Object.keys(slots)).toEqual([REVIEW, SHADOWING])
    expect(slots[REVIEW]!.sentences).toEqual([])
  })
})
