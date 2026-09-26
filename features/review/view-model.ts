/**
 * `/review`'s pure engine (platform design §2.4, §5.4 step 3, §5.5, §5.7; RF-4; Part B-M5 task
 * 5.3): the cross-track review queue — every active track's due items merged, Weak first → items
 * of a weak topic → most overdue → lowest level → ID (§5.4 step 3, widened across tracks, since
 * `dueQueue` sorts one track at a time) — with `?track=` filtering (an unknown or inactive value
 * reads as all). No React, no I/O: `catalog`, `enrollments`, `items` and `today` all come in as
 * plain data; `queries.ts` reads them and loads a due flashcard's sides.
 */
import { itemHref } from '@/features/items/href'
import type { ItemMode, PlanCatalog, PlanItem } from '@/lib/domain/catalog'
import { compareIds } from '@/lib/domain/compare'
import { reviewMode } from '@/lib/domain/plan/reviewMode'
import type { Enrollment } from '@/lib/domain/plan/types'
import type { ItemState } from '@/lib/domain/state'
import { weakTopics } from '@/lib/domain/stats/weakTopics'
import { daysBetween, type LocalDay } from '@/lib/domain/time/localDay'

export type ReviewEntry = {
  readonly itemId: string
  readonly trackId: string
  readonly mode: ItemMode
  readonly minutes: number
  readonly weak: boolean
  readonly overdueDays: number
  readonly href: string
}

/** A due item before it is sorted (mirrors `dueQueue`'s `DueEntry`, across every active track). */
type Candidate = {
  readonly itemId: string
  readonly item: PlanItem
  readonly state: ItemState
  readonly overdueDays: number
  readonly mode: ItemMode
}

/** `itemId`'s local ID (after its track's prefix): `itemHref`'s `localId` (decision 24 of 5.1b). */
function localIdOf(itemId: string): string {
  return itemId.slice(itemId.indexOf(':') + 1)
}

/** `/t/<track>/items/<local id>?mode=<mode>` — a plain item page, no plan block (off-plan). */
function hrefOf(entry: Candidate): string {
  const path = itemHref({ trackId: entry.item.trackId, localId: localIdOf(entry.itemId) })
  return `${path}?${new URLSearchParams({ mode: entry.mode }).toString()}`
}

/** The same tie-break order as `dueQueue`'s (private) comparator, widened across tracks. */
function compareCandidates(weakTopicIds: ReadonlySet<string>) {
  return (a: Candidate, b: Candidate): number => {
    const weakDiff = Number(b.state.weak) - Number(a.state.weak)
    if (weakDiff !== 0) return weakDiff

    const aWeakTopic = a.item.topicId !== null && weakTopicIds.has(a.item.topicId)
    const bWeakTopic = b.item.topicId !== null && weakTopicIds.has(b.item.topicId)
    const topicDiff = Number(bWeakTopic) - Number(aWeakTopic)
    if (topicDiff !== 0) return topicDiff

    const overdueDiff = b.overdueDays - a.overdueDays
    if (overdueDiff !== 0) return overdueDiff

    const levelDiff = a.state.level - b.state.level
    if (levelDiff !== 0) return levelDiff

    return compareIds(a.itemId, b.itemId)
  }
}

/**
 * Due entries of every active track — `dueOn ≤ today`, status not mastered or skipped, catalog
 * item active with `srs` (as `dueQueue`, one track at a time) — merged and sorted Weak first →
 * items of a weak topic (of the active tracks) → most overdue → lowest level → ID. `track`, when
 * it names an active track, filters to it; any other value (missing, unknown, paused, removed)
 * reads as all.
 */
export function reviewQueue(input: {
  readonly catalog: PlanCatalog
  readonly enrollments: readonly Enrollment[]
  readonly items: Readonly<Record<string, ItemState>>
  readonly today: LocalDay
  readonly track?: string
}): ReviewEntry[] {
  const { catalog, enrollments, items, today, track } = input

  const activeTrackIds = new Set(
    enrollments
      .filter((enrollment) => enrollment.status === 'active')
      .map((enrollment) => enrollment.trackId),
  )
  const weakTopicIds = new Set(
    weakTopics(items, catalog, activeTrackIds).map((topic) => topic.topicId),
  )

  const candidates: Candidate[] = []
  for (const [itemId, state] of Object.entries(items)) {
    if (!activeTrackIds.has(state.trackId)) continue
    if (state.dueOn === null) continue
    if (daysBetween(state.dueOn, today) < 0) continue
    if (state.status === 'mastered' || state.status === 'skipped') continue

    const item = catalog.items[itemId]
    if (item === undefined || item.status !== 'active' || item.srs === null) continue

    candidates.push({
      itemId,
      item,
      state,
      overdueDays: daysBetween(state.dueOn, today),
      mode: reviewMode(item, state),
    })
  }
  candidates.sort(compareCandidates(weakTopicIds))

  const validTrack = track !== undefined && activeTrackIds.has(track) ? track : null
  const filtered =
    validTrack === null
      ? candidates
      : candidates.filter((entry) => entry.item.trackId === validTrack)

  return filtered.map((entry) => ({
    itemId: entry.itemId,
    trackId: entry.item.trackId,
    mode: entry.mode,
    minutes: entry.item.minutes[entry.mode],
    weak: entry.state.weak,
    overdueDays: entry.overdueDays,
    href: hrefOf(entry),
  }))
}
