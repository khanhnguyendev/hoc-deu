import { CalendarCheck } from 'lucide-react'
import { EmptyState } from '@/components/patterns/empty-state'
import { PageHeader } from '@/components/patterns/page-header'
import { Section } from '@/components/patterns/section'
import { CardSession } from '@/features/items/components/outcome/card-session'
import type { RecordOutcome } from '@/features/items/outcome'
import { fill, formatNumber } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'
import type { ReviewPage } from '../queries'
import type { ReviewItemSlot } from '../slots'
import { ReviewFilters } from './review-filters'
import { ReviewList } from './review-list'

const copy = vi.review

/**
 * `/review` (§2.4; task 5.3): PageHeader with the total due (under the current `?track=`), the
 * filter chips (only with a track to filter by), the due cards' `CardSession` and the other due
 * items' `ReviewList` — or, with nothing at all due, the EmptyState linking to `/today` (RF-4).
 * `record` is `recordOutcome` (features/checkin), unbound, from the page; it does not revalidate
 * `/review`, so the session keeps its list (decision 19).
 */
function ReviewView({
  page,
  rows,
  record,
}: {
  page: ReviewPage
  /** The other due items' registry rows (`reviewRows(page.entries)`, built by the page). */
  rows: readonly ReviewItemSlot[]
  record: RecordOutcome
}) {
  return (
    <div data-slot="review-view" className="contents">
      <PageHeader
        title={vi.nav.review}
        description={fill(copy.due, { n: formatNumber(page.entries.length) })}
      />
      {page.tracks.length > 0 && <ReviewFilters tracks={page.tracks} active={page.track} />}
      {page.entries.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title={copy.emptyTitle}
          action={{ label: vi.nav.today, href: '/today' }}
        />
      ) : (
        <>
          <Section title={copy.cardsTitle}>
            <CardSession cards={page.cards} requestId={page.requestId} record={record} />
          </Section>
          {rows.length > 0 && (
            <Section title={copy.itemsTitle}>
              <ReviewList items={rows} />
            </Section>
          )}
        </>
      )}
    </div>
  )
}

export { ReviewView }
