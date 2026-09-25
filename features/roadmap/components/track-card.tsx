import Link from 'next/link'
import { useId } from 'react'
import { Banner } from '@/components/patterns/banner'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { ItemStatusBadge } from '@/features/items/components/item-status-badge'
import { fill } from '@/features/items/components/mdx/copy'
import { formatNumber, variantLabel } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'
import type { Enrollment, TrackSummary } from '../queries'

const copy = vi.roadmap

type TrackCardProps = {
  track: TrackSummary
  /** The learner's enrollment ("Lộ trình của bạn"), or null for another track. */
  enrollment: Enrollment | null
}

/**
 * A track on `/tracks` (platform design §2.4): its title, the track chip (the English title in
 * the track accent), the learner's status, variant and minutes, and "Xem lộ trình"; another active
 * track adds "Thêm trong Cài đặt". A draft (admins) is marked "Bản nháp"; a retired track says it
 * takes no new learners.
 */
type Followed = Enrollment & { status: Exclude<Enrollment['status'], 'removed'> }

/** An active or paused enrollment; a removed one is none. */
const isFollowed = (enrollment: Enrollment | null): enrollment is Followed =>
  enrollment !== null && enrollment.status !== 'removed'

function TrackCard({ track, enrollment }: TrackCardProps) {
  const titleId = useId()
  const followed = isFollowed(enrollment) ? enrollment : null
  return (
    <article
      data-slot="track-card"
      data-accent={track.accent}
      aria-labelledby={titleId}
      className="flex h-full flex-col gap-3 rounded-lg border border-border bg-surface p-4"
    >
      <h3 id={titleId} className="text-lg font-semibold">
        {track.title}
      </h3>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="track" lang="en">
          {track.titleEn}
        </Badge>
        {followed !== null && (
          <Badge tone={followed.status === 'active' ? 'primary' : 'warning'}>
            {copy.status[followed.status]}
          </Badge>
        )}
        <ItemStatusBadge status={track.status} />
      </div>
      {followed !== null && (
        <p className="text-sm text-muted-foreground">
          <span>{variantLabel(followed.roadmapVariant)}</span> <span aria-hidden="true">·</span>{' '}
          <span>{fill(copy.budget, { minutes: formatNumber(followed.budgetMinutes) })}</span>
        </p>
      )}
      {track.status === 'retired' && <Banner tone="warning">{copy.retired}</Banner>}
      <div className="mt-auto flex flex-wrap gap-2">
        <Link href={`/t/${track.id}`} className={buttonVariants({ variant: 'outline' })}>
          {copy.view}
          <span className="sr-only"> {track.title}</span>
        </Link>
        {followed === null && track.status === 'active' && (
          <Link href="/settings" className={buttonVariants({ variant: 'ghost' })}>
            {copy.addInSettings}
          </Link>
        )}
      </div>
    </article>
  )
}

export { TrackCard }
export type { TrackCardProps }
