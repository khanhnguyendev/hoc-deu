/**
 * `/today`'s rows through the item registry (§3.2, §7.6): each block item's type's `Row` with the
 * learner's state, the block's mode and the `?block=&mode=` link, plus the shadowing cards'
 * sentences. Server-only (the registry and the generated catalog); the page calls `todaySlots`.
 */
import 'server-only'
import type * as React from 'react'
import { isItemOfType } from '@/features/items/narrow'
import { isNoteVisible } from '@/features/items/problem/note'
import { getItemType } from '@/features/items/registry'
import type { ItemRowProps, ItemStateView, ItemType } from '@/features/items/types'
import { getItem } from '@/lib/content/catalog'
import type { CatalogItem } from '@/lib/content/catalog-types'
import type { ItemState } from '@/lib/domain/state'
import type { BlockItemSlot, BlockSlots, ShadowingSentence, TodaySlots } from './slots'
import type { BlockView, TodayPage } from './view-model'

/**
 * The item's own type's Row, typed for any item. Sound for the reason `renderItemRow`'s is: the
 * registry maps each type to that type's definition. `renderItemRow` links to the plain item
 * page; a block's rows need `?block=&mode=`, so the Row gets the block's href here.
 */
function rowOf(item: CatalogItem): React.ComponentType<ItemRowProps<ItemType>> {
  return (getItemType(item.type) as unknown as { Row: React.ComponentType<ItemRowProps<ItemType>> })
    .Row
}

function stateView(state: ItemState | undefined): ItemStateView | null {
  return state === undefined
    ? null
    : { status: state.status, level: state.level, dueOn: state.dueOn }
}

/** RF-4: a problem whose note a learner cannot see (none yet, or a draft) — §5.9. */
function hasNoVisibleNote(item: CatalogItem): boolean {
  return isItemOfType(item, 'problem') && !isNoteVisible(item.content.note, false)
}

function itemSlots(view: BlockView, states: TodayPage['data']['items']): BlockItemSlot[] {
  return view.items.flatMap(({ itemId, mode, href }) => {
    const item = getItem(itemId)
    // An item the catalog no longer lists (its ID retired by hand, ADR-0010) has no page.
    if (item === null) return []
    const Row = rowOf(item)
    return [
      {
        itemId,
        row: (
          <Row
            key={itemId}
            item={item}
            state={stateView(states[itemId])}
            mode={mode}
            href={href}
            showStatus
          />
        ),
        noNote: hasNoVisibleNote(item),
      },
    ]
  })
}

/** §5.6: the example sentence of each listed card that has one, in block order. */
function sentencesOf(view: BlockView): ShadowingSentence[] {
  return (view.block.shadowing ?? []).flatMap((itemId) => {
    const item = getItem(itemId)
    if (item === null || !isItemOfType(item, 'flashcard')) return []
    const text = item.content.example
    return text === undefined ? [] : [{ itemId, text }]
  })
}

/** Every shown block's slots, keyed by block ID. */
export function todaySlots(page: TodayPage): TodaySlots {
  return Object.fromEntries(
    page.blocks.map((view): [string, BlockSlots] => [
      view.block.id,
      { items: itemSlots(view, page.data.items), sentences: sentencesOf(view) },
    ]),
  )
}
