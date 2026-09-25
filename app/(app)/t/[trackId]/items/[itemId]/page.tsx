import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { renderItemPage } from '@/features/items'
import { getItemPage, ItemView } from '@/features/roadmap'

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
 * One route for every item type (§2.4, §3.2; decision 24): the registry's Page for the item —
 * `renderItemPage` loads its MDX and code — under a link back to its track. Draft items are for
 * admins; a retired item shows its notice (ItemPageFrame, M3-R4). Results arrive with task 5.2.
 */
export default async function ItemPage(props: PageProps<'/t/[trackId]/items/[itemId]'>) {
  const model = await load(props)
  const page = await renderItemPage(model.item, {
    state: null,
    context: {},
    viewer: model.viewer,
    resolveItem: model.resolveItem,
  })
  return <ItemView backHref={model.backHref} trackTitle={model.track.title} page={page} />
}
