/**
 * Dry-run proposals (§6.2; Part B-M6 decision 11): a dry-run write validates fully, then stores
 * what it would have written in `bot_run_users.detail[kind].proposal` — the entry's other keys
 * (the invalid attempts `bot_record_write` counts) kept — and writes nothing else. A proposal is at
 * most `PROPOSAL_BYTES` as canonical JSON: past that, the caller's `smaller` form is stored. Shared
 * by `PUT …/plan`, `…/custom-items` and `…/overrides`. Server-only; the secret-key client.
 */
import 'server-only'
import { canonicalJson } from '@/lib/canonical-json'
import type { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/lib/supabase/database.types'
import type { RunUser } from './runs'
import type { WriteKind } from './writes'

/** Decision 11: a dry-run proposal is at most 16 KB as JSON. */
export const PROPOSAL_BYTES = 16 * 1024

type Admin = ReturnType<typeof createAdminClient>

const isObject = (value: unknown): value is Record<string, Json | undefined> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/** `full` when it fits `PROPOSAL_BYTES`, else `smaller()` (which must fit). */
export function boundedProposal(full: unknown, smaller: () => unknown): Json {
  const fits = (value: unknown) => Buffer.byteLength(canonicalJson(value), 'utf8') <= PROPOSAL_BYTES
  if (fits(full)) return full as Json
  const cut = smaller()
  if (!fits(cut)) throw new Error('A dry-run proposal is too large to store')
  return cut as Json
}

/** Stores `proposal` in `bot_run_users.detail[kind].proposal` (decision 11). */
export async function recordProposal(
  admin: Admin,
  runUser: RunUser,
  kind: WriteKind,
  proposal: Json,
): Promise<void> {
  const current = await admin
    .from('bot_run_users')
    .select('detail')
    .eq('id', runUser.runUserId)
    .single()
  if (current.error) throw new Error('Could not read the run detail', { cause: current.error })
  const detail = isObject(current.data.detail) ? current.data.detail : {}
  const own = detail[kind]
  const entry = isObject(own) ? { ...own, proposal } : { proposal }
  const updated = await admin
    .from('bot_run_users')
    .update({ detail: { ...detail, [kind]: entry } })
    .eq('id', runUser.runUserId)
  if (updated.error) throw new Error('Could not record the proposal', { cause: updated.error })
}
