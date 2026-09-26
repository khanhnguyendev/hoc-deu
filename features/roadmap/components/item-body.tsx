/**
 * The item route's slow part (task 5.1c): loads the item's MDX and code (`renderItemPage`) and
 * renders its registry Page. An async server component, so `ItemView` can wrap it in its
 * `<Suspense>` boundary instead of the removed `(app)/loading.tsx` — the route validates the
 * params and calls `notFound()` before this ever starts rendering, so an unknown or hidden item
 * never streams a 200 first (§7.5). Results arrive with task 5.2 (state stays null here).
 */
import 'server-only'
import type * as React from 'react'
import { renderItemPage } from '@/features/items'
import type { ItemLink, ItemViewer } from '@/features/items/types'
import type { CatalogItem } from '@/lib/content/catalog-types'

async function ItemBody({
  item,
  viewer,
  resolveItem,
}: {
  item: CatalogItem
  viewer: ItemViewer
  resolveItem: (id: string) => ItemLink | null
}): Promise<React.ReactNode> {
  return renderItemPage(item, { state: null, context: {}, viewer, resolveItem })
}

export { ItemBody }
