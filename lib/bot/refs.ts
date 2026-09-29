/**
 * Per-run pseudonymous user refs (§6.3, ADR-0027): `u_` + the first 16 characters of the
 * lowercase RFC 4648 base32 of HMAC-SHA256(`BOT_REF_SECRET`, `<user id>:<run uuid>`) — 80 bits.
 * Stored in `bot_run_users.user_ref` at run start, which is how the server resolves a ref
 * (`resolveRunUser`); without the secret a ref cannot be linked to the user id, and it changes with
 * every run. Server-only: it takes the secret.
 */
import 'server-only'
import { createHmac } from 'node:crypto'

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567'
/** 16 base32 characters = 80 bits = the digest's first 10 bytes. */
const REF_CHARS = 16

function base32(bytes: Uint8Array, chars: number): string {
  let out = ''
  let buffer = 0
  let bits = 0
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte
    bits += 8
    while (bits >= 5 && out.length < chars) {
      bits -= 5
      out += ALPHABET[(buffer >> bits) & 31]
    }
    buffer &= (1 << bits) - 1
  }
  return out
}

export function userRef(userId: string, runUuid: string, secret: string): string {
  const digest = createHmac('sha256', secret).update(`${userId}:${runUuid}`, 'utf8').digest()
  return `u_${base32(digest.subarray(0, (REF_CHARS * 5) / 8), REF_CHARS)}`
}
