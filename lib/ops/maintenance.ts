import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Database } from '@/lib/supabase/database.types'
import { lastSuccessfulRun, type WorkflowFile } from './github'

export type StepOutcome = 'ok' | 'failed'
export type MaintenanceReport = {
  readonly ok: boolean
  readonly steps: Readonly<Record<'dbSize' | 'prune' | 'backups', StepOutcome>>
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
 * The daily maintenance (§2.3, §8.4 item 3; ADR-0034), called by `/api/cron/maintenance` after
 * `requireCronSecret`. Every step runs, each in its own try/catch: the DB size, the prune of old
 * `event_quota` and `ops_metrics` rows, and the last successful backup and restore test from the
 * public GitHub API. Then `cron.last_run_at` is recorded. Running twice or skipping a day is
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

  const steps = { dbSize, prune, backups }
  const ok = Object.values(steps).every((outcome) => outcome === 'ok') && lastRun === 'ok'
  return { ok, steps }
}
