/**
 * `ops_metrics` rows for the `/admin` specs (task 5.6), written with the local stack's secret key
 * like `users.ts`. The table is global: a spec that seeds a row deletes exactly that row (by id)
 * in a `finally`, and runs the block serially. Only types are imported from `lib/`.
 */
import { createRequire } from 'node:module'
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

export type OpsMetricKey = Database['public']['Tables']['ops_metrics']['Row']['key']

/** Records `value` for `key` now — the latest row of that key — and returns the row's id. */
export async function seedOpsMetric(key: OpsMetricKey, value: number): Promise<number> {
  const { data, error } = await admin()
    .from('ops_metrics')
    .insert({ key, value })
    .select('id')
    .single()
  if (error) throw new Error(`seedOpsMetric(${key}) failed: ${error.message}`)
  return data.id
}

/** Deletes one seeded row (never the cron's). */
export async function deleteOpsMetric(id: number): Promise<void> {
  const { error } = await admin().from('ops_metrics').delete().eq('id', id)
  if (error) throw new Error(`deleteOpsMetric(${id}) failed: ${error.message}`)
}
