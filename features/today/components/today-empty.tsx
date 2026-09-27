import { CalendarCheck, CalendarClock, Route } from 'lucide-react'
import { EmptyState } from '@/components/patterns/empty-state'
import { reviewHref } from '@/features/items/href'
import type { LocalDay } from '@/lib/domain/time/localDay'
import { fill, formatDay } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'

const copy = vi.today.empty

type TodayEmptyProps =
  /** Every active track starts after today (§5.4 step 2, §5.9). */
  | { kind: 'notStarted'; startDate: LocalDay }
  /** No active track (§5.4 step 2). */
  | { kind: 'noTracks' }
  /** Today's plan holds no block (RF-4): it still keeps the gate open tomorrow. `due`: the items
   *  due today (TodayStats' total) — the review is offered only when there is one (M4). */
  | { kind: 'noBlocks'; due: number }

/** `/today` without work to show (RF-4): an EmptyState with one action each — an empty plan's is
 *  `/review` while items are due (m-11), else the roadmaps: `/review` with nothing due is an
 *  empty state that links back here (M4). */
function TodayEmpty(props: TodayEmptyProps) {
  switch (props.kind) {
    case 'notStarted':
      return (
        <EmptyState
          icon={CalendarClock}
          title={fill(copy.notStarted.title, { date: formatDay(props.startDate) })}
          description={copy.notStarted.description}
          action={{ label: copy.notStarted.action, href: '/tracks' }}
        />
      )
    case 'noTracks':
      return (
        <EmptyState
          icon={Route}
          title={copy.noTracks.title}
          description={copy.noTracks.description}
          action={{ label: copy.noTracks.action, href: '/settings' }}
        />
      )
    case 'noBlocks': {
      const review = props.due > 0
      return (
        <EmptyState
          icon={CalendarCheck}
          title={copy.noBlocks.title}
          description={review ? copy.noBlocks.reviewDescription : copy.noBlocks.tracksDescription}
          action={
            review
              ? { label: copy.noBlocks.reviewAction, href: reviewHref(null) }
              : { label: copy.noBlocks.tracksAction, href: '/tracks' }
          }
          titleAs="h3"
        />
      )
    }
  }
}

export { TodayEmpty }
export type { TodayEmptyProps }
