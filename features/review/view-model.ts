/**
 * `/review`'s pure engine (platform design §2.4, §5.4 step 3, §5.5, §5.7; RF-4; Part B-M5 task
 * 5.3): the cross-track review queue — `dueQueue` per eligible track, with that track's own weak
 * topics, merged with the exported `compareDueEntries` — with `?track=` filtering (an unknown or
 * ineligible value reads as all). No React, no I/O: `catalog`, `enrollments`, `items` and `today`
 * all come in as plain data; `queries.ts` reads them and loads a due flashcard's sides.
 *
 * Track eligibility is the plan engine's own (`eligibleTracks`, §5.4 steps 1-2 — active
 * enrollment, started, catalog track active), not merely `status === 'active'` (review round 1,
 * M7); `/today`'s due counts and weak topics use the same rule (`countedTrackIds`, UI I-2), so the
 * two pages never disagree about which track's items count.
 */
import { itemHrefFromId } from '@/features/items/href'
import type { ItemMode, PlanCatalog } from '@/lib/domain/catalog'
import { compareDueEntries, dueQueue, type DueEntry } from '@/lib/domain/plan/queues'
import { eligibleTracks } from '@/lib/domain/plan/track'
import type { Enrollment, PlanContext } from '@/lib/domain/plan/types'
import type { ItemState } from '@/lib/domain/state'
import { weakTopics } from '@/lib/domain/stats/weakTopics'
import type { LocalDay } from '@/lib/domain/time/localDay'

export type ReviewEntry = {
  readonly itemId: string
  readonly trackId: string
  readonly mode: ItemMode
  readonly minutes: number
  readonly weak: boolean
  readonly overdueDays: number
  readonly href: string
}

/** `/t/<track>/items/<local id>?mode=<mode>` — a plain item page, no plan block (off-plan). */
function hrefOf(entry: DueEntry): string {
  return itemHrefFromId(entry.itemId, { mode: entry.mode })
}

function toReviewEntry(entry: DueEntry): ReviewEntry {
  return {
    itemId: entry.itemId,
    trackId: entry.item.trackId,
    mode: entry.mode,
    minutes: entry.minutes,
    weak: entry.state.weak,
    overdueDays: entry.overdueDays,
    href: hrefOf(entry),
  }
}

/**
 * The tracks a review queue draws from — active, started, catalog-active — the plan engine's own
 * rule (`eligibleTracks`, §5.4 steps 1-2), not merely `status === 'active'` (M7): a track removed
 * and re-enrolled with a future start date keeps its old `item_state` rows (only `track.reset`
 * deletes them) but is not yet eligible, so its due items stay off `/review` until its plan does.
 */
export function reviewTrackIds(input: {
  readonly catalog: PlanCatalog
  readonly enrollments: readonly Enrollment[]
  readonly today: LocalDay
}): ReadonlySet<string> {
  const ctx: PlanContext = {
    planDate: input.today,
    catalog: input.catalog,
    enrollments: input.enrollments,
    items: {},
    recapDone: {},
  }
  return new Set(eligibleTracks(ctx).map(({ enrollment }) => enrollment.trackId))
}

/**
 * `track`, when it names one of `trackIds`, else null (a missing, unknown or ineligible value
 * reads as all). Shared by `reviewQueue` and `queries.ts`'s reported `page.track`, so the two
 * never derive "which filter is in force" differently (review round 1, M10).
 */
export function resolveReviewTrack(
  trackIds: ReadonlySet<string>,
  track: string | undefined,
): string | null {
  return track !== undefined && trackIds.has(track) ? track : null
}

/**
 * Due entries of every eligible track (`reviewTrackIds`), `dueQueue` per track with that track's
 * own weak topics — never a second copy of the due rule or a topic id shared across tracks
 * (review round 1, I1) — merged with the exported `compareDueEntries`: Weak first → items of a
 * weak topic → most overdue → lowest level → ID. `track` filters to it when eligible; any other
 * value reads as all (`resolveReviewTrack`).
 */
export function reviewQueue(input: {
  readonly catalog: PlanCatalog
  readonly enrollments: readonly Enrollment[]
  readonly items: Readonly<Record<string, ItemState>>
  readonly today: LocalDay
  readonly track?: string
}): ReviewEntry[] {
  const { catalog, enrollments, items, today, track } = input
  const trackIds = reviewTrackIds({ catalog, enrollments, today })

  const weakTopicsByTrack = new Map(
    [...trackIds].map((trackId) => [
      trackId,
      new Set(weakTopics(items, catalog, new Set([trackId])).map((topic) => topic.topicId)),
    ]),
  )

  const dueEntries = [...trackIds].flatMap((trackId) =>
    dueQueue({
      trackId,
      items,
      catalog,
      today,
      weakTopicIds: weakTopicsByTrack.get(trackId) ?? new Set(),
    }),
  )

  // Each entry's own track's weak topics: a shared literal topic id across tracks never leaks
  // (weakTopics keys its groups by trackId/topicId; `weakTopicsByTrack` keeps that separation).
  const isWeakTopic = (entry: DueEntry): boolean =>
    entry.item.topicId !== null &&
    (weakTopicsByTrack.get(entry.item.trackId)?.has(entry.item.topicId) ?? false)

  dueEntries.sort(compareDueEntries(isWeakTopic))

  const validTrack = resolveReviewTrack(trackIds, track)
  const filtered =
    validTrack === null
      ? dueEntries
      : dueEntries.filter((entry) => entry.item.trackId === validTrack)

  return filtered.map(toReviewEntry)
}
