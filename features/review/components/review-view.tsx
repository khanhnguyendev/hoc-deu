import { PageHeader } from '@/components/patterns/page-header'
import type { RecordOutcome } from '@/features/items/outcome'
import { fill, formatNumber } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'
import type { ReviewPage } from '../queries'
import type { ReviewItemSlot } from '../slots'
import { ReviewSession } from './review-session'

const copy = vi.review

/**
 * `/review` (§2.4; task 5.3): PageHeader with the total due under the current `?track=` (a
 * deliberate choice over the grand total — documented in COMPONENTS.md, task 5.3 review finding
 * M3), then `ReviewSession` — the filter chips, the due cards' `CardSession` and the other due
 * items' `ReviewList`, or the RF-4 empty state — keyed by `page.track` so a genuine filter change
 * (a different `?track=`) starts a fresh session while a same-filter revalidation (every grade
 * re-renders `/review`, since `recordOutcome`'s `revalidatePath` calls carry a fresh render of the
 * calling page even though `/review` is not itself one of them — review round 1, finding I3) reuses
 * it and keeps whatever it started with (decisions 19, `ReviewSession`'s own doc).
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
      <ReviewSession key={page.track ?? 'all'} page={page} rows={rows} record={record} />
    </div>
  )
}

export { ReviewView }
