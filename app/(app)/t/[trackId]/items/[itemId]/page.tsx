import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getItemPage, ItemBody, ItemView } from '@/features/roadmap'

async function load({ params }: PageProps<'/t/[trackId]/items/[itemId]'>) {
  const { trackId, itemId } = await params
  const model = await getItemPage(trackId, itemId)
  if (model === null) notFound()
  return model
}

export async function generateMetadata(
  props: PageProps<'/t/[trackId]/items/[itemId]'>,
): Promise<Metadata> {
  const { item } = await load(props)
  return { title: `${item.title} — Học Đều` }
}

/**
 * One route for every item type (§2.4, §3.2; decision 24): a link back to its track, then the
 * item's page under a link back to its track. Draft items are for admins; a retired item shows its
 * notice (ItemPageFrame, M3-R4). Results arrive with task 5.2.
 *
 * Task 5.1c: this segment has no `loading.tsx` and the params are validated (`notFound()`) before
 * anything renders, so an unknown, mismatched or hidden item answers a real HTTP 404 — never the
 * old 200 + `noindex` (the removed `(app)/loading.tsx` used to make every page here stream before
 * `notFound()` ran, see `(app)/not-found.tsx`). The item's MDX and code (`renderItemPage`) load
 * inside `ItemBody`, an async server component `ItemView` wraps in its own `<Suspense>` boundary —
 * that is the only part allowed to suspend.
 */
export default async function ItemPage(props: PageProps<'/t/[trackId]/items/[itemId]'>) {
  const model = await load(props)
  return (
    <ItemView
      backHref={model.backHref}
      trackTitle={model.track.title}
      page={<ItemBody item={model.item} viewer={model.viewer} resolveItem={model.resolveItem} />}
    />
  )
}
