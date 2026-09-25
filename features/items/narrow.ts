/**
 * The one sanctioned way to test an item's type outside the registry (gate-review fix 4): screens
 * never `switch` on item types (`tools/guards/item-type-branching.ts`); code that must pick items
 * of one type — a roadmap week's problems, its decks' cards — narrows with this. Pure.
 */
import type { CatalogItem } from '@/lib/content/catalog-types'
import type { ItemType } from '@/lib/content/schemas/common'

export function isItemOfType<K extends ItemType>(
  item: CatalogItem,
  type: K,
): item is Extract<CatalogItem, { type: K }> {
  return item.type === type
}
