/**
 * `/review`'s other due items through the item registry (§3.2, §7.6; task 5.3): every non-
 * flashcard entry's registry Row, with its mode and href (the plain item page, `?mode=` — no
 * plan block: off-plan study). Server-only (the registry and the generated catalog); the page
 * calls `reviewRows`.
 */
import 'server-only'
import type * as React from 'react'
import { isItemOfType } from '@/features/items/narrow'
import { getItemType } from '@/features/items/registry'
import type { ItemRowProps, ItemType } from '@/features/items/types'
import { getItem } from '@/lib/content/catalog'
import type { CatalogItem } from '@/lib/content/catalog-types'
import type { ReviewItemSlot } from './slots'
import type { ReviewEntry } from './view-model'

/**
 * The item's own type's Row, typed for any item — sound for the reason `renderItemRow`'s is (the
 * registry maps each type to that type's definition).
 */
function rowOf(item: CatalogItem): React.ComponentType<ItemRowProps<ItemType>> {
  return (getItemType(item.type) as unknown as { Row: React.ComponentType<ItemRowProps<ItemType>> })
    .Row
}

/**
 * The "Bài cần ôn" list's slots: every due entry the card session does not show (a flashcard is
 * its, `getReview`'s `cards`) — its registry Row (no `state`/`showStatus`: `ReviewEntry` carries
 * only `weak`, not the full learner state the registry's own status pill needs) and `weak`, which
 * `ReviewList` shows as a pill under the row (as `BlockItemList` does for a problem's "Chưa có ghi
 * chú"). An item the catalog no longer lists (its ID retired by hand, ADR-0010) has no row.
 */
export function reviewRows(entries: readonly ReviewEntry[]): readonly ReviewItemSlot[] {
  return entries.flatMap((entry) => {
    const item = getItem(entry.itemId)
    if (item === null || isItemOfType(item, 'flashcard')) return []
    const Row = rowOf(item)
    return [
      {
        itemId: entry.itemId,
        row: (
          <Row key={entry.itemId} item={item} state={null} mode={entry.mode} href={entry.href} />
        ),
        weak: entry.weak,
      },
    ]
  })
}
