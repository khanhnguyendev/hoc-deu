/**
 * AI plans for `e2e/ai-plan.spec.ts` (task 6.5b), written with the local stack's secret key like
 * `plans.ts`. The rows are written **directly into `day_plans`**, not through
 * `apply_system_event('plan.ai_proposed')`: the database refuses the bot's writes while
 * `bot_settings.dry_run` is on (its seeded value), and only 6.8's `bot-api.spec.ts` may change
 * that global row (Part B-M6 decision 23); the SQL path is 6.2b's pgTAP and 6.8's. Plans are never
 * deleted — cleanup deletes the users (decision 35 of M4). Only types are imported from `lib/`.
 */
import { createRequire } from 'node:module'
import type * as Supabase from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

// Same reason as e2e/support/users.ts: Node 22's ESM loader trips on @supabase/auth-js's
// circular CommonJS requires, so the client is required rather than imported.
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

/**
 * What `plan.ai_proposed` does to an untouched plan (§2.3, ADR-0018): `source 'ai'`, the rationale,
 * `version + 1`, `seen_at` kept. Used both on a freshly seeded plan (the AI plan a learner opens)
 * and on a plan a page already shows (the bot's write racing an open page, decision 36).
 */
export async function makeAiPlan(planId: string, rationale: string): Promise<number> {
  const current = await admin().from('day_plans').select('version').eq('id', planId).single()
  if (current.error) throw new Error(`read plan ${planId} failed: ${current.error.message}`)
  const version = current.data.version + 1
  const { error } = await admin()
    .from('day_plans')
    .update({ source: 'ai', rationale, version })
    .eq('id', planId)
  if (error) throw new Error(`makeAiPlan(${planId}) failed: ${error.message}`)
  return version
}
