/**
 * `/review`'s other due items through the item registry (§3.2, §7.6; §5.9 ruling M5-R26; task
 * 5.3). Server-only (the registry and the generated catalog); the page calls `reviewRows`.
 */
import 'server-only'
import { isItemOfType } from '@/features/items/narrow'
import { renderItemRow } from '@/features/items/render'
import type { ItemStateView } from '@/features/items/types'
import { getItem } from '@/lib/content/catalog'
import type { ReviewItemSlot } from './slots'
import type { ReviewEntry } from './view-model'

/**
 * The "Bài cần ôn" list's slots: every due entry the card session does not show (a flashcard is
 * its, `getReview`'s `cards`), through `renderItemRow` (task 5.3 review, finding M4 — no local
 * registry cast) with its mode and href (no plan block: the plain item page, `?mode=`) and
 * `showNoteHint` (a problem without a visible note says so in its row, as `/today`). The "Yếu"
 * pill renders inside the row's own link, `showStatus` only when the entry is Weak — `state` is
 * `null` otherwise, so a non-Weak due item never shows the registry's generic "Chưa học" pill
 * (finding M5). An item the catalog no longer lists (its ID retired by hand, ADR-0010) has no row.
 */
export function reviewRows(entries: readonly ReviewEntry[]): readonly ReviewItemSlot[] {
  return entries.flatMap((entry) => {
    const item = getItem(entry.itemId)
    if (item === null || isItemOfType(item, 'flashcard')) return []
    const state: ItemStateView | null = entry.weak
      ? { status: 'weak', level: 0, dueOn: null }
      : null
    return [
      {
        itemId: entry.itemId,
        row: renderItemRow(item, {
          state,
          mode: entry.mode,
          href: entry.href,
          showStatus: entry.weak,
          showNoteHint: true,
        }),
      },
    ]
  })
}
