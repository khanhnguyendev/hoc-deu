/**
 * Bot runs (§6.2, §6.4.1, §6.4.6; ADR-0027; Part B-M6 decisions 6, 8, 9, 12): start or resume
 * today's plan run, start a numbered publish run, finish a run, and resolve `(runId, userRef)` to
 * a user — the only way the bot side learns a user id. Server-only; the secret-key client (a bot
 * request has no session). Learner days are resolved with `lib/plans/day.ts` (every read filters
 * by `user_id`), never through `lib/plans`' entry points, which assert the session user.
 * Nothing a learner wrote is logged: log lines hold codes only.
 */
import 'server-only'
import type { PostgrestSingleResponse, SupabaseClient } from '@supabase/supabase-js'
import {
  RUN_KEY_PATTERN,
  USER_REF_PATTERN,
  type PlanRunResponse,
  type PublishRunResponse,
  type RunFinishRequest,
  type RunMode,
  type RunStartRequest,
} from '@/lib/bot/contract/runs'
import { catalogVersion } from '@/lib/content/catalog'
import { RULES_VERSION } from '@/lib/domain/rules'
import type { LocalDay } from '@/lib/domain/time/localDay'
import { serverEnv } from '@/lib/env'
import { loadDay, resolveDay } from '@/lib/plans/day'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Database } from '@/lib/supabase/database.types'
import { opsDay } from './ops-day'
import { userRef } from './refs'
import { readBotSettings, type BotSettings } from './settings'

type Client = SupabaseClient<Database>
type RunRow = Database['public']['Tables']['bot_runs']['Row']
type Outcome = NonNullable<Database['public']['Tables']['bot_run_users']['Row']['outcome']>

const RUN_COLUMNS = 'id, run_key, kind, mode, status, users_deferred'
type Run = Pick<RunRow, 'id' | 'run_key' | 'kind' | 'mode' | 'status' | 'users_deferred'>

/** Postgres' unique violation. */
const UNIQUE_VIOLATION = '23505'

type DbError = { code?: string; message: string }

function failed(what: string, error: DbError): Error {
  return new Error(`Could not ${what}`, { cause: error })
}

function must<T>(what: string, result: PostgrestSingleResponse<T>): T {
  if (result.error) throw failed(what, result.error)
  return result.data
}

/** Decision 8: dry-run wins — the bot may ask for it, and never escalates to live. */
export function strictestMode(...modes: readonly (RunMode | undefined)[]): RunMode {
  return modes.includes('dry_run') ? 'dry_run' : 'live'
}

const settingsMode = (settings: BotSettings): RunMode => (settings.dryRun ? 'dry_run' : 'live')

function refSecret(): string {
  const secret = serverEnv().botRefSecret
  // lib/env requires it while BOT_API_ENABLED is on, and requireBotToken runs first.
  if (secret === undefined) throw new Error('BOT_REF_SECRET is not set')
  return secret
}

const asMode = (mode: string): RunMode => (mode === 'live' ? 'live' : 'dry_run')

// ---------------------------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------------------------

/**
 * `POST /runs` (§6.4.1). The lazy timeout first (`bot_timeout_runs`, §6.2), then the ops day
 * (Asia/Ho_Chi_Minh). A plan run: `run_<day>` is created with the decided mode, or read and
 * resumed; a publish run is numbered. See ADR-0027.
 */
export async function startRun(
  input: RunStartRequest,
  now: Date,
): Promise<PlanRunResponse | PublishRunResponse> {
  const admin = createAdminClient()
  must('time out stale runs', await admin.rpc('bot_timeout_runs'))
  const { settings } = await readBotSettings()
  const day = opsDay(now)
  const mode = strictestMode(input.requestedMode, settingsMode(settings))
  return input.kind === 'publish'
    ? startPublishRun(admin, day, mode)
    : startPlanRun(admin, day, mode, settings, now)
}

async function startPlanRun(
  admin: Client,
  day: LocalDay,
  mode: RunMode,
  settings: BotSettings,
  now: Date,
): Promise<PlanRunResponse> {
  const runKey = `run_${day}`
  const base = {
    runId: runKey,
    catalogVersion: catalogVersion(),
    rulesVersion: RULES_VERSION,
    contentProposals: settings.contentProposals,
  }
  const inserted = await admin
    .from('bot_runs')
    .insert({ run_key: runKey, kind: 'plan', ops_date: day, mode })
    .select(RUN_COLUMNS)
    .single()
  if (!inserted.error) {
    const { users, deferredUsers } = await walkNewRun(admin, inserted.data, settings, now)
    return { ...base, mode, users, deferredUsers }
  }
  if (inserted.error.code !== UNIQUE_VIOLATION) throw failed('create the plan run', inserted.error)

  // One plan run per date: a retry or a second runner resumes it (decision 8).
  const run = must(
    'read the plan run',
    await admin.from('bot_runs').select(RUN_COLUMNS).eq('run_key', runKey).single(),
  )
  const resumed = strictestMode(asMode(run.mode), mode)
  if (run.status === 'completed') {
    return { ...base, mode: resumed, users: [], deferredUsers: run.users_deferred }
  }
  must(
    'resume the plan run',
    await admin
      .from('bot_runs')
      .update({ status: 'running', failure_reason: null, finished_at: null, mode: resumed })
      .eq('id', run.id),
  )
  const pending = must(
    'read the pending users',
    await admin
      .from('bot_run_users')
      .select('user_ref')
      .eq('run_id', run.id)
      .is('outcome', null)
      .order('created_at')
      .order('user_ref'),
  )
  return {
    ...base,
    mode: resumed,
    users: pending.map((row) => row.user_ref),
    deferredUsers: run.users_deferred,
  }
}

/** What the pre-filter makes of one eligible user: a row's outcome, pending, or no row. */
type PreFilter = Outcome | 'pending' | null

/** The latest plan dated on or before `today` is an AI plan the learner has not seen (§5.2). */
async function latestPlanIsUnseenAi(
  admin: Client,
  userId: string,
  today: LocalDay,
): Promise<boolean> {
  const latest = must(
    'read the latest plan',
    await admin
      .from('day_plans')
      .select('source, seen_at')
      .eq('user_id', userId)
      .lte('plan_date', today)
      .order('plan_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
  )
  return latest !== null && latest.source === 'ai' && latest.seen_at === null
}

/**
 * Decision 9: the user's day resolved as the learner's page would (`loadDay` + `resolveDay`, the
 * secret-key client). `paused` and `resumed` (resuming is today's work) → `skipped_gate_closed`;
 * `noTracks` / `notStarted` → not eligible today, no row; an unseen AI plan as the latest plan →
 * `skipped_unseen`; `today` / `open` → pending. A read that fails → `error` (logged by code only).
 */
async function preFilter(admin: Client, userId: string, now: Date): Promise<PreFilter> {
  try {
    const day = await loadDay(admin, userId, now)
    const resolution = await resolveDay(admin, userId, day)
    switch (resolution.kind) {
      case 'paused':
      case 'resumed':
        return 'skipped_gate_closed'
      case 'noTracks':
      case 'notStarted':
        return null
      case 'today': {
        const { row } = resolution.read
        return row.source === 'ai' && row.seen_at === null ? 'skipped_unseen' : 'pending'
      }
      case 'open':
        return (await latestPlanIsUnseenAi(admin, userId, day.today)) ? 'skipped_unseen' : 'pending'
    }
  } catch {
    console.error('[bot] run start: a user could not be resolved (outcome error)')
    return 'error'
  }
}

/**
 * A new plan run: the eligible users (`bot_eligible_users()`, least recently processed first),
 * pre-filtered in that order until `per_run_user_cap` are pending — each batch resolved in
 * parallel, never past the cap. The users never examined are deferred (§6.2). Rows are inserted
 * once the walk is done; a walk that fails deletes the run (best effort), so a retry starts over.
 */
async function walkNewRun(
  admin: Client,
  run: Run,
  settings: BotSettings,
  now: Date,
): Promise<{ users: string[]; deferredUsers: number }> {
  try {
    const eligible = must('read the eligible users', await admin.rpc('bot_eligible_users'))
    const secret = refSecret()
    const cap = settings.perRunUserCap
    const rows: Database['public']['Tables']['bot_run_users']['Insert'][] = []
    const users: string[] = []
    let examined = 0
    while (users.length < cap && examined < eligible.length) {
      const batch = eligible.slice(examined, examined + (cap - users.length))
      examined += batch.length
      const outcomes = await Promise.all(batch.map((user) => preFilter(admin, user.user_id, now)))
      batch.forEach((user, index) => {
        const outcome = outcomes[index] ?? null
        if (outcome === null) return
        const ref = userRef(user.user_id, run.id, secret)
        rows.push({
          run_id: run.id,
          user_id: user.user_id,
          user_ref: ref,
          outcome: outcome === 'pending' ? null : outcome,
        })
        if (outcome === 'pending') users.push(ref)
      })
    }
    const deferredUsers = eligible.length - examined
    if (rows.length > 0) {
      must('record the run users', await admin.from('bot_run_users').insert(rows))
    }
    must(
      'record the run counts',
      await admin
        .from('bot_runs')
        .update({ users_eligible: eligible.length, users_deferred: deferredUsers })
        .eq('id', run.id),
    )
    return { users, deferredUsers }
  } catch (error) {
    await admin
      .from('bot_runs')
      .delete()
      .eq('id', run.id)
      .then(
        () => undefined,
        () => undefined,
      )
    throw error
  }
}

/**
 * A publish run `run_<day>_publish-<n>`, n = 1 + today's publish runs (a unique violation — a
 * concurrent start took n — is retried once). It runs even when today's plan run completed, and
 * touches no learner data: the pending publish requests that are in no PR yet.
 */
async function startPublishRun(
  admin: Client,
  day: LocalDay,
  mode: RunMode,
): Promise<PublishRunResponse> {
  let runKey: string | null = null
  for (let attempt = 1; runKey === null; attempt += 1) {
    const counted = await admin
      .from('bot_runs')
      .select('id', { count: 'exact', head: true })
      .eq('ops_date', day)
      .eq('kind', 'publish')
    if (counted.error) throw failed("count today's publish runs", counted.error)
    const key = `run_${day}_publish-${(counted.count ?? 0) + 1}`
    const inserted = await admin
      .from('bot_runs')
      .insert({ run_key: key, kind: 'publish', ops_date: day, mode })
    if (!inserted.error) runKey = key
    else if (inserted.error.code !== UNIQUE_VIOLATION || attempt >= 2) {
      throw failed('create the publish run', inserted.error)
    }
  }
  const requests = must(
    'read the publish requests',
    await admin
      .from('content_publish_requests')
      .select('id, target')
      .eq('status', 'pending')
      .is('pr_url', null)
      .order('id'),
  )
  return {
    runId: runKey,
    mode,
    publishRequests: requests.map((request) => ({ requestId: request.id, target: request.target })),
  }
}

// ---------------------------------------------------------------------------------------------
// Finish
// ---------------------------------------------------------------------------------------------

export type IgnoredPublishRequest = {
  readonly requestId: number
  readonly reason: 'not_pending' | 'not_a_publish_run' | 'no_pr_url'
}

export type FinishResult =
  | { readonly outcome: 'ok'; readonly ignored: readonly IgnoredPublishRequest[] }
  | { readonly outcome: 'not_found' }

/**
 * `PATCH /runs/{runId}` (§6.4.6): the status, `finished_at`, the summary (counts only, the
 * contract refuses anything else) and the content PR URL; a failed run's reason is `reported`.
 * On a publish run with a PR URL, `publish_set_pr` sets it on the listed requests that are still
 * pending; the other ids are ignored and returned.
 */
export async function finishRun(
  runKey: string,
  input: RunFinishRequest,
  now: Date,
): Promise<FinishResult> {
  if (!RUN_KEY_PATTERN.test(runKey)) return { outcome: 'not_found' }
  const admin = createAdminClient()
  const run = must(
    'read the run',
    await admin.from('bot_runs').select('id, kind').eq('run_key', runKey).maybeSingle(),
  )
  if (run === null) return { outcome: 'not_found' }

  must(
    'finish the run',
    await admin
      .from('bot_runs')
      .update({
        status: input.status,
        finished_at: now.toISOString(),
        failure_reason: input.status === 'failed' ? 'reported' : null,
        ...(input.summary === undefined ? {} : { summary: input.summary }),
        ...(input.contentPrUrl === undefined ? {} : { content_pr_url: input.contentPrUrl }),
      })
      .eq('id', run.id),
  )

  const ids = [...new Set(input.publishRequestIds ?? [])]
  if (ids.length === 0) return { outcome: 'ok', ignored: [] }
  const ignoreAll = (reason: IgnoredPublishRequest['reason']) => ({
    outcome: 'ok' as const,
    ignored: ids.map((requestId) => ({ requestId, reason })),
  })
  if (run.kind !== 'publish') return ignoreAll('not_a_publish_run')
  if (input.contentPrUrl === undefined) return ignoreAll('no_pr_url')

  const pending = must(
    'read the publish requests',
    await admin.from('content_publish_requests').select('id').in('id', ids).eq('status', 'pending'),
  )
  const pendingIds = new Set(pending.map((row) => row.id))
  if (pendingIds.size > 0) {
    must(
      "set the requests' PR",
      await admin.rpc('publish_set_pr', { p_ids: [...pendingIds], p_pr_url: input.contentPrUrl }),
    )
  }
  return {
    outcome: 'ok',
    ignored: ids
      .filter((id) => !pendingIds.has(id))
      .map((requestId) => ({ requestId, reason: 'not_pending' as const })),
  }
}

// ---------------------------------------------------------------------------------------------
// Resolve
// ---------------------------------------------------------------------------------------------

export type RunUser = {
  readonly runUuid: string
  readonly runKey: string
  readonly mode: 'live' | 'dry_run'
  readonly runUserId: string
  readonly userId: string
  readonly userRef: string
}

/**
 * Decision 6: the only way to a user id. Null when the run is unknown, not running, not a plan
 * run, or the ref is not in it. The mode is the strictest of the run's and the current
 * `bot_settings.dry_run` (decision 8): an admin who turns dry-run on mid-run makes the rest of the
 * run dry, and the run row says so.
 */
export async function resolveRunUser(runKey: string, ref: string): Promise<RunUser | null> {
  if (!RUN_KEY_PATTERN.test(runKey) || !USER_REF_PATTERN.test(ref)) return null
  const admin = createAdminClient()
  const run = must(
    'read the run',
    await admin
      .from('bot_runs')
      .select('id, run_key, kind, mode, status')
      .eq('run_key', runKey)
      .maybeSingle(),
  )
  if (run === null || run.status !== 'running' || run.kind !== 'plan') return null
  const user = must(
    'read the run user',
    await admin
      .from('bot_run_users')
      .select('id, user_id, user_ref')
      .eq('run_id', run.id)
      .eq('user_ref', ref)
      .maybeSingle(),
  )
  if (user === null) return null

  const { settings } = await readBotSettings()
  const mode = strictestMode(asMode(run.mode), settingsMode(settings))
  if (mode !== run.mode) {
    must(
      'record the dry-run mode',
      await admin.from('bot_runs').update({ mode }).eq('id', run.id).eq('mode', 'live'),
    )
  }
  return {
    runUuid: run.id,
    runKey: run.run_key,
    mode,
    runUserId: user.id,
    userId: user.user_id,
    userRef: user.user_ref,
  }
}
