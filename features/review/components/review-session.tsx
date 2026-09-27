'use client'

import { CalendarCheck } from 'lucide-react'
import { useState } from 'react'
import { EmptyState } from '@/components/patterns/empty-state'
import { Section } from '@/components/patterns/section'
import { CardSession } from '@/features/items/components/outcome/card-session'
import type { RecordOutcome } from '@/features/items/outcome'
import { vi } from '@/lib/i18n/vi'
import type { ReviewPage } from '../queries'
import type { ReviewItemSlot } from '../slots'
import { ReviewFilters } from './review-filters'
import { ReviewList } from './review-list'

const copy = vi.review

/**
 * `/review`'s filter chips, card session and list — everything that must not flicker or unmount
 * when the server re-renders the page after a grade (task 5.3 review, findings I2, I3, M2, M3).
 *
 * `recordOutcome` calls `revalidatePath` for `/today` and the item's own page (never `/review`
 * itself), but any `revalidatePath` inside a server action still carries a fresh render of the
 * page the action was called from in its response — so `/review` re-renders with new props after
 * every grade, whichever entries are still due. A structural decision that reacted to that prop
 * change on every render would unmount `CardSession` mid-session (losing its end state, its save
 * announcement and focus) or flip the whole page to the RF-4 empty state while other tracks still
 * had due items. So the decisions that must survive a revalidation are frozen at mount, in this
 * client leaf, and the page keys it by `page.track` (`review-view.tsx`) so a genuine filter
 * change — a different navigation, a new mount — starts a fresh session with the new filter's
 * cards, while a same-filter revalidation reuses this instance and its frozen decisions.
 *
 * `page.tracks`/`page.track` (the filter chips) and `rows` (the other due items) stay live: only
 * whether to show the chips at all, whether "Thẻ" appears, and which empty state (if any) shows
 * are frozen.
 */
function ReviewSession({
  page,
  rows,
  record,
}: {
  page: ReviewPage
  /** The other due items' registry rows (`reviewRows(page.entries)`, built by the page). */
  rows: readonly ReviewItemSlot[]
  record: RecordOutcome
}) {
  const [mounted] = useState(() => {
    const unfilteredTotal = page.tracks.reduce((sum, track) => sum + track.count, 0)
    const isEmpty = page.entries.length === 0
    return {
      showChips: unfilteredTotal > 0,
      hasCards: page.cards.length > 0,
      isEmpty,
      /** A filter with nothing due while another track still has some (M3): a different empty
       *  line, since "Không có mục nào cần ôn hôm nay" would be false. */
      filteredEmpty: isEmpty && page.track !== null && unfilteredTotal > 0,
    }
  })

  return (
    <>
      {mounted.showChips && <ReviewFilters tracks={page.tracks} active={page.track} />}
      {mounted.isEmpty ? (
        <EmptyState
          icon={CalendarCheck}
          title={mounted.filteredEmpty ? copy.emptyFilteredTitle : copy.emptyTitle}
          action={{ label: vi.nav.today, href: '/today' }}
        />
      ) : (
        <>
          {mounted.hasCards && (
            <Section title={copy.cardsTitle}>
              <CardSession
                cards={page.cards}
                requestId={page.requestId}
                record={record}
                headingLevel={3}
              />
            </Section>
          )}
          {rows.length > 0 && (
            <Section title={copy.itemsTitle}>
              <ReviewList items={rows} />
            </Section>
          )}
        </>
      )}
    </>
  )
}

export { ReviewSession }
