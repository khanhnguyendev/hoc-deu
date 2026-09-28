/**
 * Idempotent bot writes (§6.4; Part B-M6 decisions 10, 11, 12; ruling M6-R18). Every write route
 * (`PUT …/plan`, `…/custom-items`, `…/overrides`) resolves its run user, reads the body
 * (`readBody`), then hands its write to `idempotentWrite`:
 *
 * 1. `Idempotency-Key` must equal `<runId>:<userRef>:<kind>` → else `400
 *    {"error":"invalid_idempotency_key"}`, before anything is read or written.
 * 2. The body's hash is the SHA-256 of its canonical JSON (`bodyHash`). A response already stored
 *    for the kind (`bot_run_users.writes[kind]`) is replayed for the same hash — `write` is not
 *    called — and another hash is `409 {"error":"idempotency_conflict"}`.
 * 3. Otherwise `write` runs. An answer with an `outcome` is recorded by `bot_record_write`
 *    (insert-if-absent, under the run user's row lock): `applied`, `dry_run` and `skipped_*`
 *    bind the key (the entry is `{ outcome, status, body, bodyHash }`, its details cut to fit the
 *    32 KB bound of `writes`); `invalid` never binds it — it is counted, a corrected body is
 *    accepted, and a fourth invalid attempt is `409 {"error":"too_many_attempts"}`. A concurrent
 *    first write that stored before this one makes this answer its stored response (or 409). An
 *    answer without an outcome (a transient error) is returned and never recorded.
 *
 * `write` makes its own write idempotent too (event id `deriveEventId(<run uuid>,
 * '<userRef>:<kind>[:<n>]')`), so a crash between the write and the record makes the retry a
 * `duplicate` answered from the stored rows. Server-only; the secret-key client.
 */
import 'server-only'
import type { Json } from '@/lib/supabase/database.types'
import { createAdminClient } from '@/lib/supabase/admin'
import { bodyHash, canonicalJson } from '@/lib/canonical-json'
import { botError, botJson } from './route'
import type { RunUser } from './runs'

export type WriteKind = 'plan' | 'custom-items' | 'overrides'
/** The outcomes `bot_record_write` takes (`error` is the run start's alone). */
export type WriteOutcome =
  | 'applied'
  | 'dry_run'
  | 'skipped_plan_in_use'
  | 'skipped_gate_closed'
  | 'skipped_unseen'
  | 'invalid'

/**
 * One stored entry's bound: three kinds share `writes`' 32 KB (`octet_length(writes::text) <=
 * 32768`), with room for the keys and the hashes.
 */
export const STORED_ENTRY_BYTES = 10 * 1024

type Entry = { outcome: WriteOutcome; status: number; body: Record<string, unknown> }
type StoredEntry = { status: number; body: unknown; bodyHash: string }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const bytes = (value: unknown) => Buffer.byteLength(canonicalJson(value), 'utf8')

/** Keeps the longest prefix of `body.details` that fits; a body that cannot fit is a bug. */
function fitted(entry: Entry): Entry {
  if (bytes(entry) <= STORED_ENTRY_BYTES) return entry
  const details = entry.body.details
  if (Array.isArray(details)) {
    const cut = (kept: number): Entry => ({
      ...entry,
      body: { ...entry.body, details: details.slice(0, kept) },
    })
    let low = 0
    let high = details.length - 1
    while (low < high) {
      const mid = Math.ceil((low + high) / 2)
      if (bytes(cut(mid)) <= STORED_ENTRY_BYTES) low = mid
      else high = mid - 1
    }
    if (bytes(cut(low)) <= STORED_ENTRY_BYTES) return cut(low)
  }
  throw new Error(`A ${entry.outcome} answer is too large to store`)
}

function asStored(value: unknown): StoredEntry | null {
  if (!isRecord(value)) return null
  const { status, body, bodyHash: hash } = value
  if (typeof status !== 'number' || typeof hash !== 'string') return null
  return { status, body, bodyHash: hash }
}

/** The stored answer for the same body; another body under the key is a conflict. */
function replay(stored: StoredEntry, hash: string): Response {
  if (stored.bodyHash !== hash) return botError(409, 'idempotency_conflict')
  return botJson(stored.status, stored.body)
}

export async function idempotentWrite<T extends Record<string, unknown>>(
  runUser: RunUser,
  kind: WriteKind,
  request: Request,
  body: unknown,
  write: () => Promise<{ status: number; body: T; outcome?: WriteOutcome }>,
): Promise<Response> {
  const expectedKey = `${runUser.runKey}:${runUser.userRef}:${kind}`
  if (request.headers.get('idempotency-key') !== expectedKey) {
    return botError(400, 'invalid_idempotency_key')
  }
  const hash = bodyHash(body)
  const admin = createAdminClient()

  const current = await admin
    .from('bot_run_users')
    .select('writes')
    .eq('id', runUser.runUserId)
    .single()
  if (current.error) throw new Error('Could not read the stored writes', { cause: current.error })
  const already = isRecord(current.data.writes) ? asStored(current.data.writes[kind]) : null
  if (already !== null) return replay(already, hash)

  const answer = await write()
  if (answer.outcome === undefined) return botJson(answer.status, answer.body)
  // Only an answer that binds the key is stored, so only it is cut to fit `writes`; an invalid
  // one is only counted (its record carries no body) and is answered in full.
  const binds = answer.outcome !== 'invalid'
  const entry: Entry = binds
    ? fitted({ outcome: answer.outcome, status: answer.status, body: answer.body })
    : { outcome: answer.outcome, status: answer.status, body: {} }

  const recorded = await admin.rpc('bot_record_write', {
    p_run_user_id: runUser.runUserId,
    p_kind: kind,
    p_body_hash: hash,
    p_entry: entry as unknown as Json,
  })
  if (recorded.error) {
    if (recorded.error.message === 'too_many_attempts') return botError(409, 'too_many_attempts')
    throw new Error('Could not record the write', { cause: recorded.error })
  }
  const result = isRecord(recorded.data) ? recorded.data : {}
  if (result.stored === true) return botJson(entry.status, entry.body)
  const stored = asStored(result.entry)
  if (stored !== null) return replay(stored, hash)
  // An invalid answer, counted (it binds nothing): its full details.
  return botJson(answer.status, answer.body)
}
