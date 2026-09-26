import type { Metadata } from 'next'
import { recordOutcome } from '@/features/checkin'
import { getReview, reviewRows, ReviewView } from '@/features/review'
import { vi } from '@/lib/i18n/vi'

export const metadata: Metadata = { title: `${vi.nav.review} — Học Đều` }

/** `?track=` when it is a single value: `getReview` filters to it (an unknown value reads as all). */
async function load({ searchParams }: PageProps<'/review'>) {
  const { track } = await searchParams
  return getReview(typeof track === 'string' ? track : undefined)
}

/**
 * `/review` (§2.4; task 5.3): `getReview()` reads the cross-track due queue (Weak first) and the
 * due flashcards' sides; the page renders the other due items' rows through the registry
 * (`reviewRows`, server-only) and hands the server action to the client leaf unbound
 * (`CardSession` builds its own `OutcomeInput`).
 */
export default async function ReviewPage(props: PageProps<'/review'>) {
  const page = await load(props)
  return <ReviewView page={page} rows={reviewRows(page.entries)} record={recordOutcome} />
}
