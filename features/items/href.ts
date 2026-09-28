/**
 * Item URLs (decision 24): `/t/<trackId>/items/<localId>`, the local ID `encodeURIComponent`-encoded
 * because derived card IDs contain colons; and the review queue's URL, which item screens link to.
 * A learner's custom item (`user:<bot_ref>:<slug>`, Part B-M6 decision 39) has no local ID: its
 * URL carries the whole ID, `/t/<trackId>/items/<encodeURIComponent(itemId)>`. Pure.
 */
import { isCustomItemId } from '@/lib/domain/catalog'

/** `/t/dsa/items/lc-0001`; `/t/english/items/explaining-code%3Adsa%3Alc-0001`. */
export function itemHref(item: { trackId: string; localId: string }): string {
  return `/t/${item.trackId}/items/${encodeURIComponent(item.localId)}`
}

const withQuery = (path: string, query?: Readonly<Record<string, string>>): string =>
  query === undefined ? path : `${path}?${new URLSearchParams(query).toString()}`

/**
 * An item's page from its ID and track (decision 39): a repository item by its local ID (the part
 * after `<track>:`), a custom item by its whole ID; `query` (`?block=&mode=`, `?mode=`) when given.
 */
export function itemPageHref(
  item: { readonly id: string; readonly trackId: string },
  query?: Readonly<Record<string, string>>,
): string {
  const localId = isCustomItemId(item.id) ? item.id : item.id.slice(item.trackId.length + 1)
  return withQuery(itemHref({ trackId: item.trackId, localId }), query)
}

/**
 * The item ID for a route's `[trackId]` and `[itemId]` parameters: `<track>:<decoded local ID>`,
 * or — decision 39 — the decoded parameter itself when it is a custom item's `user:` ID (the
 * loader then checks that item's track). Decoding twice is harmless (IDs hold no `%`); a malformed
 * escape is kept as it is, which matches no item ID, so the route answers 404 instead of throwing.
 */
export function itemIdFromRoute(trackId: string, itemParam: string): string {
  let localId = itemParam
  try {
    localId = decodeURIComponent(itemParam)
  } catch {
    // URIError: keep the raw parameter.
  }
  return isCustomItemId(localId) ? localId : `${trackId}:${localId}`
}

/**
 * An item's page from its ID (`<track>:<local id>`, the track is the first segment — m-2: the
 * one place `/today` and `/review` build it), with `query` (`?block=&mode=` from a plan block,
 * `?mode=` off the plan) when given. A custom item's ID names no track: pass its `trackId`
 * (decision 39); a repository item's own track wins.
 */
export function itemHrefFromId(
  itemId: string,
  query?: Readonly<Record<string, string>>,
  trackId?: string,
): string {
  if (isCustomItemId(itemId) && trackId !== undefined) {
    return itemPageHref({ id: itemId, trackId }, query)
  }
  const separator = itemId.indexOf(':')
  return itemPageHref({ id: itemId, trackId: itemId.slice(0, separator) }, query)
}

/** `/review`, or `/review?track=<id>` — a track's review queue (m-2: its one builder). */
export function reviewHref(trackId: string | null): string {
  return trackId === null ? '/review' : `/review?${new URLSearchParams({ track: trackId })}`
}
