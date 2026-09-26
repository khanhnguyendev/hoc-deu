import { CalendarCheck, CalendarClock, Route } from 'lucide-react'
import { EmptyState } from '@/components/patterns/empty-state'
import type { LocalDay } from '@/lib/domain/time/localDay'
import { fill, formatDay } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'

const copy = vi.today.empty

type TodayEmptyProps =
  /** Every active track starts after today (§5.4 step 2, §5.9). */
  | { kind: 'notStarted'; startDate: LocalDay }
  /** No active track (§5.4 step 2). */
  | { kind: 'noTracks' }
  /** Today's plan holds no block (RF-4): it still keeps the gate open tomorrow. */
  | { kind: 'noBlocks' }

/** `/today` without work to show (RF-4): an EmptyState with one action each. */
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
    case 'noBlocks':
      return (
        <EmptyState
          icon={CalendarCheck}
          title={copy.noBlocks.title}
          description={copy.noBlocks.description}
          action={{ label: copy.noBlocks.action, href: '/tracks' }}
          titleAs="h3"
        />
      )
  }
}

export { TodayEmpty }
export type { TodayEmptyProps }
