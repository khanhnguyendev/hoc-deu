import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { serverEnv } from '@/lib/env'
import type { Database } from './database.types'

/**
 * Secret-key client: **bypasses RLS**. Only for system, bot and admin writes (§2.1) — never for
 * reading or writing on a learner's behalf, which goes through `lib/supabase/server.ts`. The only
 * place the secret key is used; ESLint keeps client modules from importing this file (SF7).
 */
export function createAdminClient(): SupabaseClient<Database> {
  const { supabaseUrl, supabaseSecretKey } = serverEnv()
  return createClient<Database>(supabaseUrl, supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
