/**
 * Item URLs (decision 24): `/t/<trackId>/items/<localId>`, the local ID `encodeURIComponent`-encoded
 * because derived card IDs contain colons; and the review queue's URL, which item screens link to.
 * Pure.
 */

/** `/t/dsa/items/lc-0001`; `/t/english/items/explaining-code%3Adsa%3Alc-0001`. */
export function itemHref(item: { trackId: string; localId: string }): string {
  return `/t/${item.trackId}/items/${encodeURIComponent(item.localId)}`
}

/**
 * The item ID for a route's `[trackId]` and `[itemId]` parameters: `<track>:<decoded local ID>`.
 * Decoding twice is harmless (IDs hold no `%`); a malformed escape is kept as it is, which matches
 * no item ID, so the route answers 404 instead of throwing.
 */
export function itemIdFromRoute(trackId: string, itemParam: string): string {
  let localId = itemParam
  try {
    localId = decodeURIComponent(itemParam)
  } catch {
    // URIError: keep the raw parameter.
  }
  return `${trackId}:${localId}`
}

/**
 * An item's page from its ID (`<track>:<local id>`, the track is the first segment — m-2: the
 * one place `/today` and `/review` build it), with `query` (`?block=&mode=` from a plan block,
 * `?mode=` off the plan) when given.
 */
export function itemHrefFromId(itemId: string, query?: Readonly<Record<string, string>>): string {
  const separator = itemId.indexOf(':')
  const path = itemHref({
    trackId: itemId.slice(0, separator),
    localId: itemId.slice(separator + 1),
  })
  return query === undefined ? path : `${path}?${new URLSearchParams(query).toString()}`
}

/** `/review`, or `/review?track=<id>` — a track's review queue (m-2: its one builder). */
export function reviewHref(trackId: string | null): string {
  return trackId === null ? '/review' : `/review?${new URLSearchParams({ track: trackId })}`
}
