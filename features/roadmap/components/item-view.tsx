import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import type * as React from 'react'
import { Suspense } from 'react'
import { LoadingState } from '@/components/patterns/loading-state'
import { withTitle } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'
import { TRACKS_HREF } from '../view-model'

/**
 * The item route's frame (platform design §2.4): a link back to the track ("Về lộ trình {title}")
 * — or to the track list ("Về danh sách lộ trình") when the loader points there, for a retired
 * track the learner does not follow — then the item's page (`page`, task 5.1c: `ItemBody`, which
 * loads the item's MDX and code). It adds no notice of its own — the page's ItemPageFrame owns the
 * draft / retired notice (M3-R4). `page` is wrapped in its own `<Suspense>` boundary (not the
 * removed `(app)/loading.tsx`): the route validates the params and calls `notFound()` before
 * `page` is ever built, so an unknown or hidden item answers a real 404 instead of streaming a 200
 * first (§7.5). A `contents` wrapper, so the link and the page keep the page's section spacing.
 */
function ItemView({
  backHref,
  trackTitle,
  page,
}: {
  backHref: string
  /** The track's Vietnamese title. */
  trackTitle: string
  page: React.ReactNode
}) {
  return (
    <div data-slot="item-view" className="contents">
      <Link
        href={backHref}
        className="inline-flex min-h-11 w-fit items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        <ChevronLeft aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0" />
        {backHref === TRACKS_HREF
          ? vi.roadmap.backToTracks
          : withTitle(vi.roadmap.backToTrack, trackTitle)}
      </Link>
      <Suspense fallback={<LoadingState variant="page" />}>{page}</Suspense>
    </div>
  )
}

export { ItemView }
