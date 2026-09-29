/**
 * `bot_runs` rows for `admin-bot.spec.ts`'s run log (task 6.4a), written with the local stack's
 * secret key like `users.ts`. **Isolation across files** (Part B-M6 decision 23): run keys are
 * per date and global, so this spec seeds only past keys (`run_2000-01-01`, `run_2000-01-02`)
 * and deletes only its own rows — never today's runs (6.8's), never `bot_settings`. Only types
 * are imported from `lib/`.
 */
import { createRequire } from 'node:module'
import type * as Supabase from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

const { createClient } = createRequire(import.meta.url)('@supabase/supabase-js') as typeof Supabase

let client: Supabase.SupabaseClient<Database> | undefined

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

/** The past keys this spec may use (decision 23). */
export const PAST_RUN_KEYS = ['run_2000-01-01', 'run_2000-01-02'] as const
export type PastRunKey = (typeof PAST_RUN_KEYS)[number]

export type SeededRun = Pick<
  Database['public']['Tables']['bot_runs']['Insert'],
  | 'mode'
  | 'status'
  | 'failure_reason'
  | 'users_eligible'
  | 'users_deferred'
  | 'content_pr_url'
  | 'summary'
>

/**
 * Upserts a finished plan run under a past key, started now (so it is among the latest 20 of
 * `admin_bot_runs`); `completed` or `failed` only — a `running` row would be timed out.
 */
export async function seedPastRun(runKey: PastRunKey, run: SeededRun): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await admin()
    .from('bot_runs')
    .upsert(
      {
        run_key: runKey,
        kind: 'plan',
        ops_date: runKey.slice(4),
        started_at: now,
        finished_at: now,
        ...run,
      },
      { onConflict: 'run_key' },
    )
  if (error) throw new Error(`seedPastRun(${runKey}) failed: ${error.message}`)
}

/** Deletes this spec's own row (its run users go with it, `on delete cascade`). */
export async function deletePastRun(runKey: PastRunKey): Promise<void> {
  const { error } = await admin().from('bot_runs').delete().eq('run_key', runKey)
  if (error) throw new Error(`deletePastRun(${runKey}) failed: ${error.message}`)
}
