/**
 * Weak topics (platform design §5.7): topics highlighted on the dashboard and prioritized on the
 * review day (§5.4 step 3). No `v_weak_topics` view (Part B-M4 decision 5) — the due list and weak
 * areas exclude retired items and tracks outside the caller's `trackIds` (paused or removed), which
 * only the catalog and the enrollments know, so this is the one place that rule lives.
 */
import type { PlanCatalog } from '../catalog'
import { compareIds } from '../compare'
import type { ItemState } from '../state'

/** A topic is weak with at least this many Weak items (§5.7). */
export const WEAK_TOPIC_MIN = 2

export type WeakTopic = {
  readonly trackId: string
  readonly topicId: string
  readonly itemIds: readonly string[]
}

type Group = { readonly trackId: string; readonly topicId: string; readonly itemIds: string[] }

/**
 * Topics of `trackIds` with ≥ `WEAK_TOPIC_MIN` items whose status is 'weak' and whose catalog item
 * is active; items sorted by ID; topics sorted by (itemIds.length desc, trackId, topicId).
 */
export function weakTopics(
  items: Readonly<Record<string, ItemState>>,
  catalog: PlanCatalog,
  trackIds: ReadonlySet<string>,
): WeakTopic[] {
  const groups = new Map<string, Group>()

  for (const [itemId, state] of Object.entries(items)) {
    if (state.status !== 'weak') continue
    if (!trackIds.has(state.trackId)) continue
    if (state.topicId === null) continue
    const catalogItem = catalog.items[itemId]
    if (catalogItem === undefined || catalogItem.status !== 'active') continue

    const key = `${state.trackId}/${state.topicId}`
    const existing = groups.get(key)
    if (existing === undefined) {
      groups.set(key, { trackId: state.trackId, topicId: state.topicId, itemIds: [itemId] })
    } else {
      existing.itemIds.push(itemId)
    }
  }

  return [...groups.values()]
    .filter((group) => group.itemIds.length >= WEAK_TOPIC_MIN)
    .map((group) => ({ ...group, itemIds: [...group.itemIds].sort(compareIds) }))
    .sort(
      (a, b) =>
        b.itemIds.length - a.itemIds.length ||
        compareIds(a.trackId, b.trackId) ||
        compareIds(a.topicId, b.topicId),
    )
}
