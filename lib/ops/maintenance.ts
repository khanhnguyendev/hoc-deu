import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getCatalog } from '@/lib/content/catalog'
import { targetStatus } from '@/lib/content/publish-targets'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Database } from '@/lib/supabase/database.types'
import { lastSuccessfulRun, pullRequestState, type WorkflowFile } from './github'

export type StepOutcome = 'ok' | 'failed'
export type MaintenanceReport = {
  readonly ok: boolean
  readonly steps: Readonly<
    Record<'dbSize' | 'prune' | 'botRuns' | 'botDetails' | 'publish' | 'backups', StepOutcome>
  >
}

type MetricKey = 'backup.last_success_at' | 'restore_test.last_success_at' | 'cron.last_run_at'

/** Which workflow's last success goes into which metric (decision 26). */
const WORKFLOW_METRICS: ReadonlyArray<readonly [WorkflowFile, MetricKey]> = [
  ['backup.yml', 'backup.last_success_at'],
  ['restore-test.yml', 'restore_test.last_success_at'],
]

/** `ops_metrics` stores timestamps as Unix epoch seconds (migration 20260927000200). */
const epochSeconds = (date: Date) => date.getTime() / 1000

/** Runs one step; a failure is logged by name (never with a secret) and reported, not thrown. */
async function attempt(name: string, run: () => Promise<void>): Promise<StepOutcome> {
  try {
    await run()
    return 'ok'
  } catch (error) {
    console.error(`[maintenance] ${name} failed:`, error instanceof Error ? error.message : error)
    return 'failed'
  }
}

/** Throws when a Supabase call returned an error. */
function check(name: string, result: { error: { message: string } | null }): void {
  if (result.error) throw new Error(`${name}: ${result.error.message}`)
}

/**
 * At most this many pull requests are looked up per run: the unauthenticated API allows 60
 * requests an hour per address (shared on Vercel), and the rest waits for the next day.
 */
const MAX_PULL_LOOKUPS = 10

const PR_NUMBER = /\/pull\/([1-9][0-9]{0,6})$/

/**
 * The publish step (§2.3, §6.6 lifecycle; Part B-M6 decision 20), over the pending
 * `content_publish_requests`: a request whose target the deployed catalog shows `active` →
 * `merged` (`publish_mark_merged`); a request with a `pr_url` whose pull request the public
 * GitHub API reports closed unmerged → `pr_url` cleared (`publish_clear_pr`), so the next publish
 * run picks it up again. A PR merged on GitHub but not deployed yet leaves its requests pending
 * until the catalog shows the flip. A PR that cannot be read fails the step after the others are
 * cleared.
 */
async function publishStep(admin: SupabaseClient<Database>, fetchImpl: typeof fetch) {
  const pending = await admin
    .from('content_publish_requests')
    .select('id, target, pr_url')
    .eq('status', 'pending')
  if (pending.error) throw new Error(`content_publish_requests: ${pending.error.message}`)
  const catalog = getCatalog()
  const rows = pending.data ?? []

  const merged = rows.filter((row) => targetStatus(catalog, row.target) === 'active')
  if (merged.length > 0) {
    const ids = merged.map((row) => row.id)
    check('publish_mark_merged', await admin.rpc('publish_mark_merged', { p_ids: ids }))
  }

  const byPull = new Map<number, number[]>()
  for (const row of rows) {
    if (merged.includes(row) || row.pr_url === null) continue
    const match = PR_NUMBER.exec(row.pr_url)
    if (match === null) continue
    const pull = Number(match[1])
    byPull.set(pull, [...(byPull.get(pull) ?? []), row.id])
  }
  // Newest first: a recently closed PR is never starved behind older open ones.
  const pulls = [...byPull.keys()].sort((a, b) => b - a).slice(0, MAX_PULL_LOOKUPS)
  const closed: number[] = []
  let unread = 0
  for (const pull of pulls) {
    const state = await pullRequestState(pull, fetchImpl).catch(() => null)
    if (state === null) unread += 1
    else if (state === 'closed') closed.push(...(byPull.get(pull) ?? []))
  }
  if (closed.length > 0) {
    check('publish_clear_pr', await admin.rpc('publish_clear_pr', { p_ids: closed }))
  }
  if (unread > 0) throw new Error(`${unread} pull request(s) could not be read`)
}

/**
 * The daily maintenance (§2.3, §8.4 item 3; ADR-0034), called by `/api/cron/maintenance` after
 * `requireCronSecret`. Every step runs, each in its own try/catch: the DB size, the prune of old
 * `event_quota` and `ops_metrics` rows, the bot sweeps (timed-out runs failed, the detail of runs
 * older than 30 days dropped — task 6.4a), the publish requests (merged marking and closed-PR
 * clearing — task 6.7a), and the last successful backup and restore test from the public GitHub
 * API. Then `cron.last_run_at` is recorded. Running twice or skipping a day is
 * harmless: each step records the current value or deletes what is already old. It never builds
 * plans (plans stay lazy, §2.3).
 *
 * A step fails when any of its writes fails or, for `backups`, when a workflow's last success
 * cannot be read (an API error, or no successful run on `main` yet) — the other workflow's value is
 * still recorded. `ok` is true when every step and the closing `cron.last_run_at` write succeeded.
 */
export async function runMaintenance(
  deps: { readonly fetch?: typeof fetch; readonly now?: Date } = {},
): Promise<MaintenanceReport> {
  const fetchImpl = deps.fetch ?? fetch
  const now = deps.now ?? new Date()
  let client: SupabaseClient<Database> | undefined
  // Created on first use, inside a step: a missing secret key fails the steps, not the route.
  const admin = () => (client ??= createAdminClient())
  const record = async (key: MetricKey, value: number) =>
    check(key, await admin().rpc('ops_record_metric', { p_key: key, p_value: value }))

  const dbSize = await attempt('dbSize', async () => {
    check('ops_record_db_size', await admin().rpc('ops_record_db_size'))
  })
  const prune = await attempt('prune', async () => {
    check('ops_prune', await admin().rpc('ops_prune'))
  })
  // §2.3, §6.2: the lazy timeout's guaranteed sweep (running > 2 h → failed / timeout), and the
  // detail (dry-run proposals, invalid details) of runs older than 30 days (decision 41).
  const botRuns = await attempt('botRuns', async () => {
    check('bot_timeout_runs', await admin().rpc('bot_timeout_runs'))
  })
  const botDetails = await attempt('botDetails', async () => {
    check('bot_prune_details', await admin().rpc('bot_prune_details'))
  })
  const publish = await attempt('publish', () => publishStep(admin(), fetchImpl))
  const backups = await attempt('backups', async () => {
    const results = await Promise.allSettled(
      WORKFLOW_METRICS.map(async ([file, key]) => {
        const at = await lastSuccessfulRun(file, fetchImpl)
        if (at === null) throw new Error(`${file}: no successful run on main could be read`)
        await record(key, epochSeconds(at))
      }),
    )
    const failure = results.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    )
    if (failure) throw failure.reason
  })
  const lastRun = await attempt('lastRun', () => record('cron.last_run_at', epochSeconds(now)))

  const steps = { dbSize, prune, botRuns, botDetails, publish, backups }
  const ok = Object.values(steps).every((outcome) => outcome === 'ok') && lastRun === 'ok'
  return { ok, steps }
}
