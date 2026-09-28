/**
 * Publish targets (§4.2, §6.6; Part B-M6 decision 20): an item ID, or `<itemId>#note` for a
 * problem's note (its own publish target, §3.3). Their status is read from the deployed catalog:
 * "Xuất bản" accepts only a draft target, and the maintenance cron marks a pending request merged
 * once its target is active. Pure: the catalog comes in.
 */
import type { Catalog } from './catalog-types'
import type { ItemStatus } from './schemas/common'

export const NOTE_SUFFIX = '#note'

/** `content_publish_requests.target`'s check: an item ID, or `<itemId>#note`. */
export const PUBLISH_TARGET_PATTERN = /^[a-z][a-z0-9-]{0,31}:[a-z0-9:-]{1,120}(#note)?$/

export function publishTarget(itemId: string, kind: 'item' | 'note'): string {
  return kind === 'note' ? `${itemId}${NOTE_SUFFIX}` : itemId
}

/** The target's status in `catalog`, or null when the catalog has no such item or note. */
export function targetStatus(catalog: Catalog, target: string): ItemStatus | null {
  const isNote = target.endsWith(NOTE_SUFFIX)
  const itemId = isNote ? target.slice(0, -NOTE_SUFFIX.length) : target
  if (!Object.hasOwn(catalog.items, itemId)) return null
  const item = catalog.items[itemId]
  if (item === undefined) return null
  if (!isNote) return item.status
  return item.type === 'problem' ? (item.content.note?.status ?? null) : null
}
