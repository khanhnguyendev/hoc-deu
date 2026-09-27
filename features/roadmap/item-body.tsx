/**
 * The item route's slow part (task 5.1c; ruling M5-R6): loads the item's MDX and code
 * (`renderItemPage`) and renders its registry Page. An async server component, so `ItemView` can
 * wrap it in its `<Suspense>` boundary instead of the removed `(app)/loading.tsx` — the route
 * validates the params and calls `notFound()` before this ever starts rendering, so an unknown or
 * hidden item never streams a 200 first (§7.5). Task 5.2c: the learner's state, the route's
 * outcome binding and the mock-interview pick reach the Page through it. A render helper, not a catalog component (like `renderItemPage` beside
 * `features/items`'s own loaders) — it lives beside `queries.ts`, not under `components/`, and is
 * described inside ItemView's `COMPONENTS.md` entry rather than its own.
 */
import 'server-only'
import type * as React from 'react'
import { renderItemPage } from '@/features/items'
import type { OutcomeBinding } from '@/features/items/outcome'
import type { ItemLink, ItemStateView, ItemViewer } from '@/features/items/types'
import type { CatalogItem } from '@/lib/content/catalog-types'

async function ItemBody({
  item,
  viewer,
  resolveItem,
  state,
  outcome,
  mockInterviewProblem,
}: {
  item: CatalogItem
  viewer: ItemViewer
  resolveItem: (id: string) => ItemLink | null
  /** The learner's state (task 5.2c); null before any result and on a read-only page. */
  state: ItemStateView | null
  /** The route's binding (`getItemPage`'s context + the unbound `recordOutcome`); absent = read-only. */
  outcome?: OutcomeBinding
  /** The mock-interview prompt's problem (§5.6), only for that prompt. */
  mockInterviewProblem?: ItemLink | null
}): Promise<React.ReactNode> {
  return renderItemPage(item, { state, viewer, resolveItem, outcome, mockInterviewProblem })
}

export { ItemBody }
