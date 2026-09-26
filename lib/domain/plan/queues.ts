/**
 * The due queue (platform design §5.4 step 3): a track's due review items, sorted for the review
 * block. No `due_items()` SQL function (Part B-M4 decision 5) — the due list excludes retired items
 * and non-`srs` item types, which only the catalog knows, so this is the one place that rule lives.
 */
import type { ItemMode, PlanCatalog, PlanItem } from '../catalog'
import { compareIds } from '../compare'
import type { ItemState } from '../state'
import { daysBetween, type LocalDay } from '../time/localDay'
import { reviewMode } from './reviewMode'

export type DueEntry = {
  readonly itemId: string
  readonly item: PlanItem
  readonly state: ItemState
  /** daysBetween(state.dueOn, today) — 0 when due today. */
  readonly overdueDays: number
  readonly mode: ItemMode
  /** item.minutes[mode]. */
  readonly minutes: number
}

function compareDueEntries(weakTopicIds: ReadonlySet<string>) {
  return (a: DueEntry, b: DueEntry): number => {
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
 * §5.4 step 3: the track's due items — `dueOn ≤ today`, status not mastered or skipped, catalog
 * item active with `srs` — sorted Weak first → items of `weakTopicIds` → most overdue → lowest
 * level → ID.
 */
export function dueQueue(input: {
  readonly trackId: string
  readonly items: Readonly<Record<string, ItemState>>
  readonly catalog: PlanCatalog
  readonly today: LocalDay
  readonly weakTopicIds: ReadonlySet<string>
}): DueEntry[] {
  const { trackId, items, catalog, today, weakTopicIds } = input
  const entries: DueEntry[] = []

  for (const [itemId, state] of Object.entries(items)) {
    if (state.trackId !== trackId) continue
    if (state.dueOn === null) continue
    if (daysBetween(state.dueOn, today) < 0) continue
    if (state.status === 'mastered' || state.status === 'skipped') continue

    const item = catalog.items[itemId]
    if (item === undefined || item.status !== 'active' || item.srs === null) continue

    const mode = reviewMode(item, state)
    entries.push({
      itemId,
      item,
      state,
      overdueDays: daysBetween(state.dueOn, today),
      mode,
      minutes: item.minutes[mode],
    })
  }

  return entries.sort(compareDueEntries(weakTopicIds))
}
