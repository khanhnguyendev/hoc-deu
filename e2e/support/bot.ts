/**
 * The bot's global state for the e2e specs (task 6.3; 6.8 adds its own helpers here), written with
 * the local stack's secret key like `users.ts`. **Isolation across files** (Part B-M6 decision
 * 23): `bot_settings` is one global row — `admin-bot.spec.ts` changes only `content_proposals` and
 * `per_run_user_cap` and restores them in `finally`; `enabled`, `dry_run` and the token belong to
 * 6.8's `bot-api.spec.ts`. Only types are imported from `lib/`.
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import type { APIRequestContext } from '@playwright/test'
import type * as Supabase from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

const { createClient } = createRequire(import.meta.url)('@supabase/supabase-js') as typeof Supabase

let client: Supabase.SupabaseClient<Database> | undefined

/** The secret-key client for the local stack (bypasses RLS). */
function admin(): Supabase.SupabaseClient<Database> {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const secretKey = process.env.SUPABASE_SECRET_KEY
    if (!url || !secretKey) {
      throw new Error('The local Supabase env is missing — run e2e through playwright.config.ts.')
    }
    client = createClient<Database>(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return client
}

/** The two `bot_settings` columns this task's specs may change (decision 23). */
export type BotSettingsPatch = { content_proposals?: boolean; per_run_user_cap?: number }

export async function readBotSettingsRow(): Promise<{
  content_proposals: boolean
  per_run_user_cap: number
}> {
  const { data, error } = await admin()
    .from('bot_settings')
    .select('content_proposals, per_run_user_cap')
    .single()
  if (error) throw new Error(`readBotSettingsRow failed: ${error.message}`)
  return data
}

/** Restores (or sets) `content_proposals` / `per_run_user_cap` — never `enabled`, `dry_run` or the token. */
export async function updateBotSettingsRow(patch: BotSettingsPatch): Promise<void> {
  const { error } = await admin().from('bot_settings').update(patch).eq('id', true)
  if (error) throw new Error(`updateBotSettingsRow failed: ${error.message}`)
}

/** `profiles.ai_personalization` of a test user. */
export async function getAiFlag(userId: string): Promise<boolean> {
  const { data, error } = await admin()
    .from('profiles')
    .select('ai_personalization')
    .eq('id', userId)
    .single()
  if (error) throw new Error(`getAiFlag(${userId}) failed: ${error.message}`)
  return data.ai_personalization
}

/**
 * Turns the AI flag off (and notes sharing with it, as `admin_set_ai_flag` does) — a spec's
 * `finally` for every account it flagged: 6.8's run counts eligible users globally.
 */
export async function setAiFlagOff(userId: string): Promise<void> {
  const { error } = await admin()
    .from('profiles')
    .update({ ai_personalization: false, share_notes_with_ai: false })
    .eq('id', userId)
  if (error) throw new Error(`setAiFlagOff(${userId}) failed: ${error.message}`)
}

// ---------------------------------------------------------------------------------------------
// Task 6.8: the §6.10 contract suite's helpers (`e2e/bot-api.spec.ts` only). The spec owns
// `enabled`, `dry_run` and the token columns (decision 23): it reads them first
// (`readBotControl`) and restores all of them in `afterAll` (`setBotSettings`).
// ---------------------------------------------------------------------------------------------

/** The `bot_settings` columns only 6.8's spec changes (decision 23). */
export type BotControl = {
  enabled: boolean
  dry_run: boolean
  token_hash: string | null
  token_prev_hash: string | null
  token_prev_valid_until: string | null
  token_rotated_at: string | null
}

export async function readBotControl(): Promise<BotControl> {
  const { data, error } = await admin()
    .from('bot_settings')
    .select(
      'enabled, dry_run, token_hash, token_prev_hash, token_prev_valid_until, token_rotated_at',
    )
    .single()
  if (error) throw new Error(`readBotControl failed: ${error.message}`)
  return data
}

/** Sets (or restores) `enabled`, `dry_run` and the token columns — never `content_proposals`
 *  or `per_run_user_cap` (admin-bot.spec's). */
export async function setBotSettings(patch: Partial<BotControl>): Promise<void> {
  const { error } = await admin().from('bot_settings').update(patch).eq('id', true)
  if (error) throw new Error(`setBotSettings failed: ${error.message}`)
}

/** The per-run cap as stored (read only: admin-bot.spec owns it). */
export async function readRunUserCap(): Promise<number> {
  return (await readBotSettingsRow()).per_run_user_cap
}

const sha256 = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex')

/** A token of the production form (`hdb_` + 43 base64url characters, ADR-0026). */
export function newToken(): string {
  return `hdb_${randomBytes(32).toString('base64url')}`
}

/**
 * A fresh token (the 120 / 10 min limit is per token): its hash becomes `token_hash`. With
 * `keepPreviousUntil`, the token in force until now becomes the previous one, valid until then —
 * what "Tạo token mới" does (§6.3). Returns the new token (never logged).
 */
export async function writeBotToken(options: { keepPreviousUntil?: Date } = {}): Promise<string> {
  const token = newToken()
  const current = await readBotControl()
  await setBotSettings({
    token_hash: sha256(token),
    token_rotated_at: new Date().toISOString(),
    ...(options.keepPreviousUntil
      ? {
          token_prev_hash: current.token_hash,
          token_prev_valid_until: options.keepPreviousUntil.toISOString(),
        }
      : { token_prev_hash: null, token_prev_valid_until: null }),
  })
  return token
}

/** The ops day (Asia/Ho_Chi_Minh, §6.2): today's run key is `run_<opsDay()>`. */
export function opsDay(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

/** Deletes today's runs — the plan run and the publish runs — and their run users (cascade). */
export async function deleteTodayRuns(): Promise<void> {
  const { error } = await admin().from('bot_runs').delete().like('run_key', `run_${opsDay()}%`)
  if (error) throw new Error(`deleteTodayRuns failed: ${error.message}`)
}

type RunRow = Database['public']['Tables']['bot_runs']['Row']

export async function runRow(runKey: string): Promise<RunRow | null> {
  const { data, error } = await admin()
    .from('bot_runs')
    .select('*')
    .eq('run_key', runKey)
    .maybeSingle()
  if (error) throw new Error(`runRow(${runKey}) failed: ${error.message}`)
  return data
}

/** How many of today's runs exist (plan and publish). */
export async function countTodayRuns(): Promise<number> {
  const { count, error } = await admin()
    .from('bot_runs')
    .select('id', { count: 'exact', head: true })
    .like('run_key', `run_${opsDay()}%`)
  if (error || count === null) throw new Error(`countTodayRuns failed: ${error?.message}`)
  return count
}

/** The run's state as a test sets it with the secret key (`failed`, `started_at` moved back). */
export async function updateRunRow(
  runKey: string,
  patch: Pick<Database['public']['Tables']['bot_runs']['Update'], 'status' | 'started_at'>,
): Promise<void> {
  const { error } = await admin().from('bot_runs').update(patch).eq('run_key', runKey)
  if (error) throw new Error(`updateRunRow(${runKey}) failed: ${error.message}`)
}

type RunUserRow = Database['public']['Tables']['bot_run_users']['Row']
export type RunUser = Pick<
  RunUserRow,
  'user_id' | 'user_ref' | 'outcome' | 'writes' | 'detail' | 'processed_at'
>

/** A run's users, read with the secret key: how the spec maps refs to its own learners. */
export async function runUsers(runKey: string): Promise<RunUser[]> {
  const run = await runRow(runKey)
  if (run === null) return []
  const { data, error } = await admin()
    .from('bot_run_users')
    .select('user_id, user_ref, outcome, writes, detail, processed_at')
    .eq('run_id', run.id)
  if (error) throw new Error(`runUsers(${runKey}) failed: ${error.message}`)
  return data
}

/** The run user row of `userId` in `runKey`, or null (no row: not examined, or not eligible). */
export async function runUserOf(runKey: string, userId: string): Promise<RunUser | null> {
  return (await runUsers(runKey)).find((row) => row.user_id === userId) ?? null
}

export type BotAnswer = { status: number; body: Record<string, unknown>; headers: Headers }

/**
 * The bot API as the Routine calls it: `Authorization: Bearer <token>`, JSON, and the
 * `Idempotency-Key` header for writes. `path` is relative to `/api/bot/v1`.
 */
export async function call(
  request: APIRequestContext,
  token: string | null,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH',
  path: string,
  body?: unknown,
  idempotencyKey?: string,
): Promise<BotAnswer> {
  const headers: Record<string, string> = {}
  if (token !== null) headers.authorization = `Bearer ${token}`
  if (idempotencyKey !== undefined) headers['idempotency-key'] = idempotencyKey
  if (body !== undefined) headers['content-type'] = 'application/json'
  const response = await request.fetch(`/api/bot/v1${path}`, {
    method,
    headers,
    ...(body === undefined ? {} : { data: JSON.stringify(body) }),
  })
  const text = await response.text()
  let parsed: Record<string, unknown> = {}
  try {
    parsed = text === '' ? {} : (JSON.parse(text) as Record<string, unknown>)
  } catch {
    parsed = { unparsed: text.slice(0, 200) }
  }
  return { status: response.status(), body: parsed, headers: new Headers(response.headers()) }
}

// ---------------------------------------------------------------------------------------------
// Learners and their rows (6.8). Users come from `users.ts`, plans from `plans.ts`; these add
// what those files do not have. Cleanup deletes the users (their rows go by cascade).
// ---------------------------------------------------------------------------------------------

/** Turns the AI flag on (and notes sharing when asked), as `admin_set_ai_flag` would. */
export async function setAiFlag(userId: string, shareNotes = false): Promise<void> {
  const { error } = await admin()
    .from('profiles')
    .update({ ai_personalization: true, share_notes_with_ai: shareNotes })
    .eq('id', userId)
  if (error) throw new Error(`setAiFlag(${userId}) failed: ${error.message}`)
}

/** The learner's opaque `bot_ref` (custom item IDs: `user:<bot_ref>:<slug>`). */
export async function botRefOf(userId: string): Promise<string> {
  const { data, error } = await admin().from('profiles').select('bot_ref').eq('id', userId).single()
  if (error) throw new Error(`botRefOf(${userId}) failed: ${error.message}`)
  return data.bot_ref
}

/** A block check-in with the learner's note (`plan_block_state.note`, §4.6). */
export async function seedNote(
  userId: string,
  planId: string,
  state: { blockId: string; trackId: string; checkedInOn: string; note: string },
): Promise<void> {
  const { error } = await admin().from('plan_block_state').insert({
    user_id: userId,
    plan_id: planId,
    block_id: state.blockId,
    track_id: state.trackId,
    status: 'done',
    minutes: 10,
    checked_in_on: state.checkedInOn,
    note: state.note,
  })
  if (error) throw new Error(`seedNote(${state.blockId}) failed: ${error.message}`)
}

/**
 * An `item.result` event (as the learner's own insert would store it; the insert trigger computes
 * `local_day`). With `planId`, the event names the plan — the plan is then touched (§2.3).
 */
export async function seedResult(
  userId: string,
  result: {
    itemId: string
    trackId: string
    result: 'solved' | 'hint' | 'failed'
    planId?: string
    blockId?: string
  },
): Promise<void> {
  const occurredAt = new Date().toISOString()
  const { error } = await admin()
    .from('events')
    .insert({
      id: randomUUID(),
      user_id: userId,
      actor_id: userId,
      source: 'learner',
      type: 'item.result',
      occurred_at: occurredAt,
      local_day: occurredAt.slice(0, 10),
      track_id: result.trackId,
      item_id: result.itemId,
      plan_id: result.planId ?? null,
      block_id: result.blockId ?? null,
      payload: { result: result.result },
    })
  if (error) throw new Error(`seedResult(${result.itemId}) failed: ${error.message}`)
}

export type PlanState = {
  id: string
  version: number
  source: string
  seen_at: string | null
  rationale: string | null
  roadmap_weeks: unknown
}

/** The learner's plan of `planDate`, or null. */
export async function planOn(userId: string, planDate: string): Promise<PlanState | null> {
  const { data, error } = await admin()
    .from('day_plans')
    .select('id, version, source, seen_at, rationale, roadmap_weeks')
    .eq('user_id', userId)
    .eq('plan_date', planDate)
    .maybeSingle()
  if (error) throw new Error(`planOn(${planDate}) failed: ${error.message}`)
  return data
}

/** The learner's custom items (id → status). */
export async function customItemsOf(userId: string): Promise<Record<string, string>> {
  const { data, error } = await admin()
    .from('user_items')
    .select('item_id, status')
    .eq('user_id', userId)
  if (error) throw new Error(`customItemsOf(${userId}) failed: ${error.message}`)
  return Object.fromEntries(data.map((row) => [row.item_id, row.status]))
}

/** The learner's overrides (`<track>:<key>` → status and who revoked it). */
export async function overridesOf(
  userId: string,
): Promise<Record<string, { status: string; revokedBy: string | null; kind: string }>> {
  const { data, error } = await admin()
    .from('roadmap_overrides')
    .select('track_id, key, kind, status, revoked_by')
    .eq('user_id', userId)
  if (error) throw new Error(`overridesOf(${userId}) failed: ${error.message}`)
  return Object.fromEntries(
    data.map((row) => [
      `${row.track_id}:${row.key}`,
      { status: row.status, revokedBy: row.revoked_by, kind: row.kind },
    ]),
  )
}

// ---------------------------------------------------------------------------------------------
// Publish requests and content signals (6.8, §6.4.6, §6.4.7).
// ---------------------------------------------------------------------------------------------

/** `admin_request_publish` called as `adminUser` (the admin's own session, not the secret key). */
export async function requestPublishAs(
  adminUser: { email: string; password: string },
  target: string,
): Promise<number> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) throw new Error('The local Supabase env is missing.')
  const session = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const signedIn = await session.auth.signInWithPassword(adminUser)
  if (signedIn.error) throw new Error(`admin sign-in failed: ${signedIn.error.message}`)
  const { data, error } = await session.rpc('admin_request_publish', { p_target: target })
  if (error) throw new Error(`admin_request_publish(${target}) failed: ${error.message}`)
  await session.auth.signOut()
  return (data as { id: number }).id
}

export type PublishRequestRow = { status: string; pr_url: string | null }

export async function publishRequestRow(id: number): Promise<PublishRequestRow | null> {
  const { data, error } = await admin()
    .from('content_publish_requests')
    .select('status, pr_url')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(`publishRequestRow(${id}) failed: ${error.message}`)
  return data
}

/** The maintenance cron's two SQL steps (6.7a), called with the secret key as the cron does. */
export async function publishMarkMerged(ids: number[]): Promise<number> {
  const { data, error } = await admin().rpc('publish_mark_merged', { p_ids: ids })
  if (error) throw new Error(`publish_mark_merged failed: ${error.message}`)
  return data
}

export async function publishClearPr(ids: number[]): Promise<number> {
  const { data, error } = await admin().rpc('publish_clear_pr', { p_ids: ids })
  if (error) throw new Error(`publish_clear_pr failed: ${error.message}`)
  return data
}

/** `content_signal_results(90)`'s row for `itemId` (only items ≥ 5 distinct learners answered). */
export async function signalResultOf(
  itemId: string,
): Promise<{ attempts: number; fails: number; users: number } | null> {
  const { data, error } = await admin().rpc('content_signal_results', { p_days: 90 })
  if (error) throw new Error(`content_signal_results failed: ${error.message}`)
  return data.find((row) => row.item_id === itemId) ?? null
}

/** Sets a custom item's stored status (a retired item: the learner's own, no longer active). */
export async function setCustomItemStatus(
  userId: string,
  itemId: string,
  status: 'active' | 'hidden' | 'retired',
): Promise<void> {
  const { error } = await admin()
    .from('user_items')
    .update({ status })
    .eq('user_id', userId)
    .eq('item_id', itemId)
  if (error) throw new Error(`setCustomItemStatus(${itemId}) failed: ${error.message}`)
}
