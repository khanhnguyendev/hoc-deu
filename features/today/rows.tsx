/**
 * `/today`'s rows through the item registry (§3.2, §7.6): each block item's Row
 * (`renderItemRow`) with the learner's state, the block's mode, the `?block=&mode=` link and the
 * note hint — the Row decides whether it has one (ruling M5-R26) — plus the shadowing cards'
 * sentences, and for a card-only block the cards its session grades inline (decision 19).
 * Server-only (the registry and the generated catalog); the page calls `todaySlots`. Task 6.6a: a
 * learner's custom item (`user:…`, in an AI plan or an extra block) is found in the day's catalog
 * overlay (`userItemOf`, decision 17) and links to its own page (decision 39).
 */
import 'server-only'
import { itemPageHref } from '@/features/items/href'
import { cardSidesOf, type CardSessionCard } from '@/features/items/outcome'
import { renderItemRow } from '@/features/items/render'
import type { ItemStateView } from '@/features/items/types'
import { getItem } from '@/lib/content/catalog'
import type { CatalogItem } from '@/lib/content/catalog-types'
import { userItemOf } from '@/lib/content/user-items'
import { isCustomItemId, type PlanCatalog } from '@/lib/domain/catalog'
import { itemHandled } from '@/lib/domain/plan/checkin'
import type { ItemState } from '@/lib/domain/state'
import type { LocalDay } from '@/lib/domain/time/localDay'
import type { BlockItemSlot, BlockSlots, ShadowingSentence, TodaySlots } from './slots'
import type { BlockView, TodayPage } from './view-model'

type States = TodayPage['data']['items']

function stateView(state: ItemState | undefined): ItemStateView | null {
  return state === undefined
    ? null
    : { status: state.status, level: state.level, dueOn: state.dueOn }
}

/** An item by ID: the generated catalog's, or the learner's custom item from the overlay. */
function itemOf(itemId: string, catalog: PlanCatalog): CatalogItem | null {
  return getItem(itemId) ?? userItemOf(catalog, itemId)
}

type Ref = BlockView['items'][number]

/** The block's items the catalog still lists (an ID retired by hand has no page, ADR-0010). */
function knownItems(view: BlockView, catalog: PlanCatalog): { ref: Ref; item: CatalogItem }[] {
  return view.items.flatMap((ref) => {
    const item = itemOf(ref.itemId, catalog)
    return item === null ? [] : [{ ref, item }]
  })
}

/**
 * The block's link to the item: the view model's, whose path comes from the ID alone; a custom
 * item's ID names no track, so its page is rebuilt from the item with the same `?block=&mode=`.
 */
function hrefOf(ref: Ref, item: CatalogItem): string {
  if (!isCustomItemId(item.id)) return ref.href
  const query = ref.href.includes('?') ? ref.href.slice(ref.href.indexOf('?') + 1) : ''
  return itemPageHref(item, Object.fromEntries(new URLSearchParams(query)))
}

function itemSlots(view: BlockView, states: States, catalog: PlanCatalog): BlockItemSlot[] {
  return knownItems(view, catalog).map(({ ref, item }) => ({
    itemId: ref.itemId,
    row: renderItemRow(item, {
      state: stateView(states[ref.itemId]),
      mode: ref.mode,
      href: hrefOf(ref, item),
      showStatus: true,
      showNoteHint: true,
    }),
  }))
}

/**
 * Decision 19: a block whose items are all flashcards grades them inline — its cards not handled
 * yet for the plan's date (a result on or after it, or skipped: `itemHandled`), each with the
 * block's id so the result names it (decision 14). Null for any other block (and a shadowing
 * block, which reads sentences).
 */
function cardsOf(
  view: BlockView,
  states: States,
  planDate: LocalDay,
  catalog: PlanCatalog,
): CardSessionCard[] | null {
  if (view.block.shadowing !== undefined) return null
  const items = knownItems(view, catalog).map(({ item }) => item)
  const cards = items.flatMap((item) => {
    const sides = cardSidesOf(item)
    return sides === null ? [] : [{ itemId: item.id, sides, blockId: view.block.id }]
  })
  if (cards.length === 0 || cards.length !== items.length) return null
  return cards.filter((card) => !itemHandled(card.itemId, planDate, states))
}

/** §5.6: the example sentence of each listed card that has one, in block order. */
function sentencesOf(view: BlockView): ShadowingSentence[] {
  return (view.block.shadowing ?? []).flatMap((itemId) => {
    const item = getItem(itemId)
    const text = item === null ? undefined : cardSidesOf(item)?.example
    return text === undefined ? [] : [{ itemId, text }]
  })
}

/** The date of the plan the dashboard shows (the paused plan's own date while paused). */
function planDateOf(page: TodayPage): LocalDay {
  const { state } = page.data
  return state.kind === 'plan' || state.kind === 'resumed' || state.kind === 'paused'
    ? state.plan.planDate
    : page.data.today
}

/** Every shown block's slots, keyed by block ID. */
export function todaySlots(page: TodayPage): TodaySlots {
  const planDate = planDateOf(page)
  return Object.fromEntries(
    page.blocks.map((view): [string, BlockSlots] => [
      view.block.id,
      {
        items: itemSlots(view, page.data.items, page.data.catalog),
        sentences: sentencesOf(view),
        cards: cardsOf(view, page.data.items, planDate, page.data.catalog),
      },
    ]),
  )
}
