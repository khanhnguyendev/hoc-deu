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
    Row: function FakeRow({
      item,
      state,
      mode,
      href,
      showStatus,
      showNoteHint,
    }: ItemRowProps<ItemType>) {
      return (
        <a
          href={href}
          data-row={type}
          data-state={state?.status ?? 'none'}
          data-mode={mode ?? 'none'}
          data-show-status={String(showStatus ?? false)}
          data-note-hint={String(showNoteHint ?? false)}
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

const SECOND_CARD = cardItem({
  id: 'english:w01-bandwidth',
  localId: 'w01-bandwidth',
  title: 'bandwidth',
  content: { front: 'bandwidth' },
})
fixtures.items[SECOND_CARD.id] = SECOND_CARD

const REVIEW = `${TODAY}:dsa:review:1`
const SHADOWING = `${TODAY}:english:practice:2`
const CARDS = `${TODAY}:english:new:1`
const MIXED = `${TODAY}:english:review:1`

const cardRef = (itemId: string, mode: 'new' | 'review' = 'new') => ({
  itemId,
  mode,
  href: `/t/english/items/${itemId.split(':')[1]}?block=b&mode=${mode}`,
})

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
      blockView({
        block: block(CARDS, { kind: 'new', trackId: 'english' }),
        items: [cardRef(CARD.id), cardRef(SECOND_CARD.id), cardRef('english:gone')],
      }),
      blockView({
        block: block(MIXED, { kind: 'review', trackId: 'english' }),
        items: [cardRef(CARD.id, 'review'), cardRef(NOTED.id, 'review')],
      }),
    ],
  },
)
const withState = { ...page, data: todayData(page.data.state, { items: { [NOTED.id]: STATE } }) }

describe('todaySlots (rows through the registry, tasks 5.1b, 5.4)', () => {
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

  it('asks every Row for its note hint: the Row decides, never the screen (ruling M5-R26, RF-4)', () => {
    render(<div>{slots[REVIEW]!.items.map((slot) => slot.row)}</div>)
    expect(screen.getAllByRole('link').map((link) => link.dataset.noteHint)).toEqual([
      'true',
      'true',
      'true',
    ])
    expect(slots[REVIEW]!.items.map((slot) => Object.keys(slot).sort())).toEqual([
      ['itemId', 'row'],
      ['itemId', 'row'],
      ['itemId', 'row'],
    ])
  })

  it("gives a shadowing block its cards' example sentences, and no rows", () => {
    expect(slots[SHADOWING]).toEqual({
      items: [],
      sentences: [{ itemId: CARD.id, text: CARD.content.example }],
      cards: null,
    })
  })

  it('has one entry per block, sentences empty for a block without shadowing cards', () => {
    expect(Object.keys(slots)).toEqual([REVIEW, SHADOWING, CARDS, MIXED])
    expect(slots[REVIEW]!.sentences).toEqual([])
    expect(slots[REVIEW]!.cards).toBeNull()
  })

  it('gives a card-only block its cards for the card session, with their sides and block (decision 19)', () => {
    expect(slots[CARDS]!.cards).toEqual([
      {
        itemId: CARD.id,
        blockId: CARDS,
        sides: {
          front: CARD.content.front,
          back: CARD.content.back,
          hint: CARD.content.hint,
          usage: CARD.content.usage,
          example: CARD.content.example,
          pronunciation: CARD.content.pronunciation,
          lang: CARD.content.lang,
        },
      },
      expect.objectContaining({ itemId: SECOND_CARD.id, blockId: CARDS }),
    ])
    // The rows stay too (a finished session's block lists them).
    expect(slots[CARDS]!.items.map((slot) => slot.itemId)).toEqual([CARD.id, SECOND_CARD.id])
  })

  it('leaves a block with any other item type to its rows', () => {
    expect(slots[MIXED]!.cards).toBeNull()
  })

  it("leaves out the cards already handled for the plan's date (graded, or skipped)", () => {
    const graded = {
      ...STATE,
      itemId: CARD.id,
      trackId: 'english',
      itemType: 'flashcard',
      status: 'ok',
      lastResultOn: TODAY,
    } as const
    const earlier = { ...graded, itemId: SECOND_CARD.id, lastResultOn: '2026-09-20' }
    const data = todayData(page.data.state, {
      items: { [CARD.id]: graded, [SECOND_CARD.id]: earlier },
    })
    const cards = todaySlots({ ...page, data })[CARDS]!.cards
    expect(cards?.map((card) => card.itemId)).toEqual([SECOND_CARD.id])

    const all = todaySlots({
      ...page,
      data: todayData(page.data.state, {
        items: { [CARD.id]: graded, [SECOND_CARD.id]: { ...graded, itemId: SECOND_CARD.id } },
      }),
    })
    expect(all[CARDS]!.cards).toEqual([])
  })

  it("counts handled cards against the paused plan's own date", () => {
    const old = storedPlan({ planDate: '2026-09-27' })
    const yesterday = {
      ...STATE,
      itemId: CARD.id,
      trackId: 'english',
      itemType: 'flashcard',
      status: 'ok',
      lastResultOn: '2026-09-27',
    } as const
    const paused = todayPage(
      { kind: 'paused', plan: old, unfinished: [], blocks: {}, daysSince: 1, offerResume: false },
      { blocks: page.blocks },
    )
    const data = todayData(paused.data.state, { items: { [CARD.id]: yesterday } })
    expect(todaySlots({ ...paused, data })[CARDS]!.cards?.map((card) => card.itemId)).toEqual([
      SECOND_CARD.id,
    ])
  })
})

describe('todaySlots — custom items (task 6.6a: the overlay, decision 39)', () => {
  const CUSTOM = 'user:0123456789abcdef:standup-card'
  const CUSTOM_BLOCK = `${TODAY}:english:practice:1`
  const CUSTOM_HREF = `/t/english/items/user%3A0123456789abcdef%3Astandup-card?${new URLSearchParams(
    { block: CUSTOM_BLOCK, mode: 'new' },
  )}`

  it('renders a custom card of a plan block through the registry, at its own URL, and grades it inline', async () => {
    const { CATALOG: GENERATED } = await import('@/.generated/catalog')
    const { withUserItems } = await import('@/lib/content/user-items')
    const catalog = withUserItems(
      page.data.catalog,
      [
        {
          itemId: CUSTOM,
          itemType: 'flashcard',
          trackId: 'english',
          topicId: 'standup',
          payload: { front: 'on hold', back: 'tạm dừng', tags: [] },
          status: 'active',
          createdOn: TODAY,
        },
      ],
      GENERATED.tracks,
    )
    const custom = todayPage(page.data.state, {
      blocks: [
        blockView({
          block: block(CUSTOM_BLOCK, { kind: 'practice', trackId: 'english' }),
          // The view model builds the custom item's own URL (decision 39); the row keeps it.
          items: [{ itemId: CUSTOM, mode: 'new', href: CUSTOM_HREF }],
        }),
      ],
    })
    const slots = todaySlots({ ...custom, data: todayData(page.data.state, { catalog }) })
    render(<div>{slots[CUSTOM_BLOCK]!.items.map((slot) => slot.row)}</div>)
    const link = screen.getByRole('link', { name: 'on hold' })
    expect(link.getAttribute('href')).toBe(CUSTOM_HREF)
    expect(link.dataset.row).toBe('flashcard')
    expect(slots[CUSTOM_BLOCK]!.cards).toEqual([
      expect.objectContaining({
        itemId: CUSTOM,
        sides: expect.objectContaining({ front: 'on hold' }),
      }),
    ])
  })

  it('an unknown custom ID (another learner’s, or gone) has no row', () => {
    const custom = todayPage(page.data.state, {
      blocks: [
        blockView({
          block: block(CUSTOM_BLOCK, { kind: 'practice', trackId: 'english' }),
          items: [{ itemId: CUSTOM, mode: 'new', href: '/x' }],
        }),
      ],
    })
    expect(todaySlots(custom)[CUSTOM_BLOCK]!.items).toEqual([])
  })
})
