import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { recordOutcome } from '@/features/checkin'
import { getItemPage, ItemBody, ItemView } from '@/features/roadmap'

/** A query parameter's first value (`?mode=a&mode=b` → `a`). */
const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value

async function load({ params, searchParams }: PageProps<'/t/[trackId]/items/[itemId]'>) {
  const { trackId, itemId } = await params
  const query = await searchParams
  // Primitive arguments, so generateMetadata and the page share one cached read (and request id).
  const model = await getItemPage(trackId, itemId, first(query.block), first(query.mode))
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
 * One route for every item type (§2.4, §3.2; decision 24): the item's page (`ItemBody`, loaded
 * inside ItemView's Suspense) under a link back to its track. Draft items are for admins; a
 * retired item shows its notice (ItemPageFrame, M3-R4).
 *
 * Task 5.1c: this segment has no `loading.tsx` and the params are validated (`notFound()`) before
 * anything renders, so an unknown, mismatched or hidden item answers a real HTTP 404 — never the
 * old 200 + `noindex` (the removed `(app)/loading.tsx` used to make every page here stream before
 * `notFound()` ran, see `(app)/not-found.tsx`). The item's MDX and code (`renderItemPage`) load
 * inside `ItemBody`, an async server component `ItemView` wraps in its own `<Suspense>` boundary —
 * that is the only part allowed to suspend.
 *
 * Task 5.2c: `?block=` and `?mode=` go to the loader, which resolves the learner's context; the
 * page binds it to `recordOutcome` — the server action itself, **unbound** (the client builds the
 * `OutcomeInput`) — and a read-only page (a draft an admin previews, a retired item) gets none.
 *
 * Task 6.6a (decision 39): a learner's own custom item has its page here too
 * (`/t/<trackId>/items/<encoded user: ID>`), rendered through the registry like any item and
 * labelled "Mục riêng của bạn"; another learner's ID is a 404 (RLS).
 */
export default async function ItemPage(props: PageProps<'/t/[trackId]/items/[itemId]'>) {
  const model = await load(props)
  const outcome = model.outcome === null ? undefined : { ...model.outcome, record: recordOutcome }
  return (
    <ItemView
      backHref={model.backHref}
      trackTitle={model.track.title}
      custom={model.custom}
      page={
        <ItemBody
          item={model.item}
          viewer={model.viewer}
          resolveItem={model.resolveItem}
          state={model.state}
          outcome={outcome}
          mockInterviewProblem={model.mockInterviewProblem}
        />
      }
    />
  )
}
