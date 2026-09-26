import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { publicSupabaseEnv } from '@/lib/env'
import type { Database } from '@/lib/supabase/database.types'

/** A health check that hangs is a failed one. */
const TIMEOUT_MS = 5_000

/**
 * Whether the database answers — the cheap query behind `/api/health` (§2.3): `health()` (task
 * 5.7a, `select true`) through PostgREST with the publishable key and no session, so `anon` runs
 * it and nothing else is reachable. Any error, a false answer, the time limit or missing public
 * Supabase values → false. `client` is for tests.
 */
export async function databaseIsHealthy(client?: SupabaseClient<Database>): Promise<boolean> {
  try {
    const supabase = client ?? anonymousClient()
    const { data, error } = await supabase
      .rpc('health')
      .abortSignal(AbortSignal.timeout(TIMEOUT_MS))
    return error === null && data === true
  } catch {
    return false
  }
}

function anonymousClient(): SupabaseClient<Database> {
  const { supabaseUrl, supabasePublishableKey } = publicSupabaseEnv()
  return createClient<Database>(supabaseUrl, supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}
