/**
 * `/today`'s rows through the item registry (§3.2, §7.6): each block item's Row
 * (`renderItemRow`) with the learner's state, the block's mode, the `?block=&mode=` link and the
 * note hint — the Row decides whether it has one (ruling M5-R26) — plus the shadowing cards'
 * sentences, and for a card-only block the cards its session grades inline (decision 19).
 * Server-only (the registry and the generated catalog); the page calls `todaySlots`.
 */
import 'server-only'
import { cardSidesOf, type CardSessionCard } from '@/features/items/outcome'
import { renderItemRow } from '@/features/items/render'
import type { ItemStateView } from '@/features/items/types'
import { getItem } from '@/lib/content/catalog'
import type { CatalogItem } from '@/lib/content/catalog-types'
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

/** The block's items the catalog still lists (an ID retired by hand has no page, ADR-0010). */
function knownItems(view: BlockView): { ref: BlockView['items'][number]; item: CatalogItem }[] {
  return view.items.flatMap((ref) => {
    const item = getItem(ref.itemId)
    return item === null ? [] : [{ ref, item }]
  })
}

function itemSlots(view: BlockView, states: States): BlockItemSlot[] {
  return knownItems(view).map(({ ref, item }) => ({
    itemId: ref.itemId,
    row: renderItemRow(item, {
      state: stateView(states[ref.itemId]),
      mode: ref.mode,
      href: ref.href,
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
function cardsOf(view: BlockView, states: States, planDate: LocalDay): CardSessionCard[] | null {
  if (view.block.shadowing !== undefined) return null
  const items = knownItems(view).map(({ item }) => item)
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
        items: itemSlots(view, page.data.items),
        sentences: sentencesOf(view),
        cards: cardsOf(view, page.data.items, planDate),
      },
    ]),
  )
}
