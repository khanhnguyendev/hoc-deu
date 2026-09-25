/**
 * Event ids derived per request (decision 9). Every form that emits events carries a `requestId`
 * the server page creates on each render; the server derives each event id from it and a stable
 * key such as `track.enrolled:dsa`. A double submit or a retry within one render therefore sends
 * the same id, and `apply_event` records the event once (`duplicate` on the retry).
 *
 * Not `server-only`: it has no secrets, and scripts outside the `react-server` condition may use it.
 */
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** UUIDv5 of `key` in the namespace `requestId` (node:crypto sha1). Deterministic. */
export function deriveEventId(requestId: string, key: string): string {
  if (!UUID.test(requestId)) {
    throw new TypeError('deriveEventId: requestId must be a UUID (8-4-4-4-12 hex digits)')
  }
  // RFC 9562 §5.5: SHA-1 of the namespace's 16 bytes followed by the name, truncated to 16 bytes,
  // with the version (5) in the high nibble of byte 6 and the variant (10xx) in byte 8.
  const bytes = createHash('sha1')
    .update(Buffer.from(requestId.replaceAll('-', ''), 'hex'))
    .update(key, 'utf8')
    .digest()
    .subarray(0, 16)
  bytes[6] = (bytes[6]! & 0x0f) | 0x50
  bytes[8] = (bytes[8]! & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-')
}
