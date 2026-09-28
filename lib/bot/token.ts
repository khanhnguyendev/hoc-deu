/**
 * The bot API's bearer token (§6.3, ADR-0026; Part B-M6 decision 7): `hdb_` + 43 base64url
 * characters (32 random bytes), shown once by `/admin/bot`; only its SHA-256 (64 lowercase hex
 * digits) is stored, in `bot_settings.token_hash`. A rotation keeps the previous hash valid for
 * 24 hours (`token_prev_hash`, `token_prev_valid_until`). Never logged.
 */
import 'server-only'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

export type TokenState = {
  hash: string | null
  prevHash: string | null
  prevValidUntil: Date | null
}

const TOKEN_PREFIX = 'hdb_'
const HASH = /^[0-9a-f]{64}$/

/** A fresh token and its hash. The token leaves the server once, in the rotation's answer. */
export function newBotToken(): { readonly token: string; readonly hash: string } {
  const token = `${TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`
  return { token, hash: tokenHash(token) }
}

/** SHA-256 hex of the whole token (prefix included). */
export function tokenHash(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

/** A stored hash as its 32-byte digest; a malformed one as null (it matches nothing). */
const storedDigest = (hash: string | null): Buffer | null =>
  hash !== null && HASH.test(hash) ? Buffer.from(hash, 'hex') : null

/**
 * The presented digest against a stored one in constant time. A missing stored digest is compared
 * against a throwaway copy, so both checks always run and cost the same.
 */
function digestEquals(presented: Buffer, stored: Buffer | null): boolean {
  const equal = timingSafeEqual(presented, stored ?? Buffer.alloc(32))
  return stored !== null && equal
}

/**
 * Constant time: `presented` against the current hash and, while valid, the previous one (valid
 * strictly before `prevValidUntil`). Both comparisons always run, on 32-byte digests, so neither
 * the token's length nor which hash matched shows in the timing.
 */
export function tokenMatches(presented: string, settings: TokenState, now: Date): boolean {
  const digest = createHash('sha256').update(presented, 'utf8').digest()
  const current = digestEquals(digest, storedDigest(settings.hash))
  const previousValid =
    settings.prevValidUntil !== null && settings.prevValidUntil.getTime() > now.getTime()
  const previous = digestEquals(digest, storedDigest(settings.prevHash))
  return current || (previousValid && previous)
}
