/**
 * Item URLs (decision 24): `/t/<trackId>/items/<localId>`, the local ID `encodeURIComponent`-encoded
 * because derived card IDs contain colons. Pure.
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
