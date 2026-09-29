/**
 * `/review`'s loader (platform design §2.4; task 5.3). `requireOnboarded` first; every read goes
 * through `lib/plans/reads.ts` with the session client (own rows, RLS) — item states through
 * `readItemStates` (paged past 1000 rows, decision 7), the three independent reads in parallel
 * (task 5.3 review, finding M10). The due flashcards' sides come from the generated catalog
 * (`getItem`) through `cardSidesOf` (features/items, m-5) — the one helper that tells a
 * flashcard from every other item, shared with `/today`'s card blocks, `reviewRows` and the
 * flashcard page: `reviewQueue`'s entries carry no item type.
 */
import 'server-only'
import { cardSidesOf, type FlashcardSides } from '@/features/items/outcome'
import { requireOnboarded } from '@/lib/auth/dal'
import { getCatalog, getItem, getTrack } from '@/lib/content/catalog'
import { userItemOf, withUserItems } from '@/lib/content/user-items'
import type { PlanCatalog } from '@/lib/domain/catalog'
import { compareIds } from '@/lib/domain/compare'
import { planCatalog } from '@/lib/plans/catalog'
import {
  readEnrollments,
  readItemStates,
  readScheduleVersions,
  readUserItems,
  todayOf,
} from '@/lib/plans/reads'
import { createClient } from '@/lib/supabase/server'
import { resolveReviewTrack, reviewQueue, reviewTrackIds, type ReviewEntry } from './view-model'

export type ReviewCard = { readonly itemId: string; readonly sides: FlashcardSides }

export type ReviewTrack = { readonly id: string; readonly title: string; readonly count: number }

export type ReviewPage = {
  readonly entries: readonly ReviewEntry[]
  /** Due flashcards, in queue order, with their sides (for CardSession). */
  readonly cards: readonly ReviewCard[]
  readonly tracks: readonly ReviewTrack[]
  /** The valid `?track=` in force, or null (all — a missing, unknown or ineligible value). */
  readonly track: string | null
  readonly requestId: string
}

/** The due flashcards among `entries`, in the same order, with their sides — a custom card's
 *  from the learner's overlay (`userItemOf`, task 6.6a). */
function cardsOf(entries: readonly ReviewEntry[], catalog: PlanCatalog): ReviewCard[] {
  return entries.flatMap((entry) => {
    const item = getItem(entry.itemId) ?? userItemOf(catalog, entry.itemId)
    const sides = item === null ? null : cardSidesOf(item)
    return sides === null ? [] : [{ itemId: entry.itemId, sides }]
  })
}

/** Every eligible track, with its title and its due count over every entry (unfiltered). */
function tracksOf(
  trackIds: ReadonlySet<string>,
  allEntries: readonly ReviewEntry[],
): ReviewTrack[] {
  const counts = new Map<string, number>()
  for (const entry of allEntries) counts.set(entry.trackId, (counts.get(entry.trackId) ?? 0) + 1)
  return [...trackIds].sort(compareIds).map((id) => ({
    id,
    title: getTrack(id)?.title.vi ?? id,
    count: counts.get(id) ?? 0,
  }))
}

/**
 * requireOnboarded; the schedule, enrollments, every item state and the learner's custom items
 * (the catalog overlay, task 6.6a), through the session client (RLS), read in parallel. `reviewTrackIds`/`resolveReviewTrack` (shared with `reviewQueue`, so
 * "which filter is in force" is never derived two different ways, finding M10) settle `?track=`;
 * a second, unfiltered `reviewQueue` call (only when a filter is in force) feeds the tracks' due
 * counts — the filter chips always show the full breakdown, whichever one is open (§2.4).
 */
export async function getReview(track: string | undefined): Promise<ReviewPage> {
  const user = await requireOnboarded()
  const supabase = await createClient()

  const [versions, enrollments, items, userItems] = await Promise.all([
    readScheduleVersions(supabase, user.id),
    readEnrollments(supabase, user.id, planCatalog()),
    readItemStates(supabase, user.id),
    readUserItems(supabase, user.id),
  ])
  // Task 6.6a (decision 17): the learner's custom cards are reviewed when due like any card — a
  // hidden or retired one reads as retired and leaves the queue (its state is kept).
  const catalog =
    userItems.length === 0
      ? planCatalog()
      : withUserItems(planCatalog(), userItems, getCatalog().tracks)
  const today = todayOf(versions, new Date())

  const trackIds = reviewTrackIds({ catalog, enrollments, today })
  const validTrack = resolveReviewTrack(trackIds, track)

  const entries = reviewQueue({ catalog, enrollments, items, today, track })
  const allEntries =
    validTrack === null ? entries : reviewQueue({ catalog, enrollments, items, today })

  return {
    entries,
    cards: cardsOf(entries, catalog),
    tracks: tracksOf(trackIds, allEntries),
    track: validTrack,
    requestId: crypto.randomUUID(),
  }
}
