/**
 * `/review`'s loader (platform design §2.4; task 5.3). `requireOnboarded` first; every read goes
 * through `lib/plans/reads.ts` with the session client (own rows, RLS) — item states through
 * `readItemStates` (paged past 1000 rows, decision 7). The due flashcards' sides come from the
 * generated catalog (`getItem`, `isItemOfType` — the one sanctioned narrowing outside the
 * registry, gate-review fix 4): `reviewQueue`'s entries carry no item type, so this is the one
 * place that tells a flashcard from every other due item.
 */
import 'server-only'
import { isItemOfType } from '@/features/items/narrow'
import type { FlashcardSides } from '@/features/items/outcome'
import { requireOnboarded } from '@/lib/auth/dal'
import { getItem, getTrack } from '@/lib/content/catalog'
import { compareIds } from '@/lib/domain/compare'
import { planCatalog } from '@/lib/plans/catalog'
import { readEnrollments, readItemStates, readScheduleVersions, todayOf } from '@/lib/plans/reads'
import { createClient } from '@/lib/supabase/server'
import { reviewQueue, type ReviewEntry } from './view-model'

export type ReviewCard = { readonly itemId: string; readonly sides: FlashcardSides }

export type ReviewTrack = { readonly id: string; readonly title: string; readonly count: number }

export type ReviewPage = {
  readonly entries: readonly ReviewEntry[]
  /** Due flashcards, in queue order, with their sides (for CardSession). */
  readonly cards: readonly ReviewCard[]
  readonly tracks: readonly ReviewTrack[]
  /** The valid `?track=` in force, or null (all — a missing, unknown or inactive value). */
  readonly track: string | null
  readonly requestId: string
}

/** The due flashcards among `entries`, in the same order, with their sides. */
function cardsOf(entries: readonly ReviewEntry[]): ReviewCard[] {
  return entries.flatMap((entry) => {
    const item = getItem(entry.itemId)
    if (item === null || !isItemOfType(item, 'flashcard')) return []
    const card = item.content
    return [
      {
        itemId: entry.itemId,
        sides: {
          front: card.front,
          back: card.back,
          hint: card.hint,
          usage: card.usage,
          example: card.example,
          pronunciation: card.pronunciation,
          lang: card.lang,
        },
      },
    ]
  })
}

/** Every active track, with its title and its due count over every entry (unfiltered). */
function tracksOf(
  activeTrackIds: ReadonlySet<string>,
  allEntries: readonly ReviewEntry[],
): ReviewTrack[] {
  const counts = new Map<string, number>()
  for (const entry of allEntries) counts.set(entry.trackId, (counts.get(entry.trackId) ?? 0) + 1)
  return [...activeTrackIds].sort(compareIds).map((id) => ({
    id,
    title: getTrack(id)?.title.vi ?? id,
    count: counts.get(id) ?? 0,
  }))
}

/**
 * requireOnboarded; the schedule, enrollments and every item state, through the session client
 * (RLS). `reviewQueue` builds the cross-track due queue (Weak first) and applies `?track=`; a
 * second, unfiltered call (only when `track` narrowed the first) feeds the tracks' due counts —
 * the filter chips always show the full breakdown, whichever one is open (§2.4).
 */
export async function getReview(track: string | undefined): Promise<ReviewPage> {
  const user = await requireOnboarded()
  const supabase = await createClient()
  const catalog = planCatalog()

  const versions = await readScheduleVersions(supabase, user.id)
  const today = todayOf(versions, new Date())
  const enrollments = await readEnrollments(supabase, user.id, catalog)
  const items = await readItemStates(supabase, user.id)

  const activeTrackIds = new Set(
    enrollments
      .filter((enrollment) => enrollment.status === 'active')
      .map((enrollment) => enrollment.trackId),
  )

  const entries = reviewQueue({ catalog, enrollments, items, today, track })
  const allEntries =
    track === undefined ? entries : reviewQueue({ catalog, enrollments, items, today })
  const validTrack = track !== undefined && activeTrackIds.has(track) ? track : null

  return {
    entries,
    cards: cardsOf(entries),
    tracks: tracksOf(activeTrackIds, allEntries),
    track: validTrack,
    requestId: crypto.randomUUID(),
  }
}
