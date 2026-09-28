import { ChevronLeft, EyeOff, UserRound } from 'lucide-react'
import Link from 'next/link'
import type * as React from 'react'
import { Suspense } from 'react'
import { LoadingState } from '@/components/patterns/loading-state'
import { Badge } from '@/components/ui/badge'
import { withTitle } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'
import { TODAY_HREF, TRACKS_HREF } from '../view-model'

/**
 * The item route's frame (platform design §2.4): a link back to the track ("Về lộ trình {title}")
 * — or to the track list ("Về danh sách lộ trình") when the loader points there, for a retired
 * track the learner does not follow, or to `/today` ("Về Hôm nay") for an item opened from a plan
 * block (m-9) — then the item's page (`page`, task 5.1c: `ItemBody`, which
 * loads the item's MDX and code). It adds no notice of its own — the page's ItemPageFrame owns the
 * draft / retired notice (M3-R4). `page` is wrapped in its own `<Suspense>` boundary (not the
 * removed `(app)/loading.tsx`): the route validates the params and calls `notFound()` before
 * `page` is ever built, so an unknown or hidden item answers a real 404 instead of streaming a 200
 * first (§7.5). A `contents` wrapper, so the link and the page keep the page's section spacing.
 * Task 6.6a: the learner's own custom item says "Mục riêng của bạn" (a badge with an icon) under
 * the link, and "Đã ẩn" (with its icon) once the learner hid it, with one line why the page is
 * read-only.
 */
function ItemView({
  backHref,
  trackTitle,
  custom = false,
  hidden = false,
  page,
}: {
  backHref: string
  /** The track's Vietnamese title. */
  trackTitle: string
  /** The learner's own custom item (`user:…`). */
  custom?: boolean
  /** A custom item the learner hid: "Đã ẩn" beside the label (never the retired notice). */
  hidden?: boolean
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
          : backHref === TODAY_HREF
            ? vi.roadmap.backToToday
            : withTitle(vi.roadmap.backToTrack, trackTitle)}
      </Link>
      {custom && (
        <div data-slot="custom-item-label" className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="primary">
              <UserRound aria-hidden="true" strokeWidth={1.75} />
              {vi.customItems.ownLabel}
            </Badge>
            {hidden && (
              <Badge tone="neutral">
                <EyeOff aria-hidden="true" strokeWidth={1.75} />
                {vi.customItems.hidden}
              </Badge>
            )}
          </div>
          {hidden && (
            <p className="text-sm text-muted-foreground">{vi.customItems.hiddenReadOnly}</p>
          )}
        </div>
      )}
      <Suspense fallback={<LoadingState variant="page" />}>{page}</Suspense>
    </div>
  )
}

export { ItemView }
