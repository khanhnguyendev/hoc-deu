/**
 * The public publish-request targets (§2.4, §6.6; Part B-M6 decision 20): `GET
 * /api/content/publish-requests` answers them for the `bot-content-policy` CI check. Read with the
 * publishable key and no session, so `anon` calls `publish_request_targets()` — the one function
 * it may call that reads a table (schema-invariants 001) — and reaches nothing else. Only the
 * targets of pending requests: no ids, people or PRs.
 */
import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { PUBLISH_TARGET_PATTERN } from '@/lib/content/publish-targets'
import { publicSupabaseEnv } from '@/lib/env'
import type { Database } from '@/lib/supabase/database.types'

/** A slow database must not hold the public endpoint open. */
const TIMEOUT_MS = 5_000

function anonymousClient(): SupabaseClient<Database> {
  const { supabaseUrl, supabasePublishableKey } = publicSupabaseEnv()
  return createClient<Database>(supabaseUrl, supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

/** The pending targets, sorted by the database. An error throws. `client` is for tests. */
export async function pendingPublishTargets(client?: SupabaseClient<Database>): Promise<string[]> {
  const supabase = client ?? anonymousClient()
  const { data, error } = await supabase
    .rpc('publish_request_targets')
    .abortSignal(AbortSignal.timeout(TIMEOUT_MS))
  if (error) throw new Error('Could not read the publish request targets', { cause: error })
  const rows: unknown[] = Array.isArray(data) ? data : []
  return rows.filter(
    (target): target is string => typeof target === 'string' && PUBLISH_TARGET_PATTERN.test(target),
  )
}
