/**
 * What pages and rows read from an item's track manifest: the topic title and the minutes an item
 * takes (§5.4, from the manifest's estimates through the type's core). Server-only through the
 * generated catalog (`lib/content/catalog`).
 */
import { getTrack } from '@/lib/content/catalog'
import type { ItemTypeCore, Mode } from '@/lib/content/item-types'
import type { TrackManifest } from '@/lib/content/schemas/manifest'

/** The item's track manifest, or null when the catalog does not know the track. */
export function trackOf(item: { trackId: string }): TrackManifest | null {
  return getTrack(item.trackId)
}

/** The topic's title (the Vietnamese one; DSA topics keep their English terms), else its ID. */
export function topicTitleOf(item: { trackId: string; topicId: string | null }): string | null {
  if (item.topicId === null) return null
  const topic = trackOf(item)?.topics.find((candidate) => candidate.id === item.topicId)
  return topic?.title.vi ?? item.topicId
}

/** Minutes for the item in `mode` (`new` by default), or null when its track is unknown. */
export function minutesOf<T>(
  core: ItemTypeCore<T>,
  item: { trackId: string; content: T },
  mode: Mode = 'new',
): number | null {
  const track = trackOf(item)
  return track === null ? null : core.estimateMinutes(item.content, track, mode)
}
