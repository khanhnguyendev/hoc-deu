/**
 * The bot's global state for the e2e specs (task 6.3; 6.8 adds its own helpers here), written with
 * the local stack's secret key like `users.ts`. **Isolation across files** (Part B-M6 decision
 * 23): `bot_settings` is one global row — `admin-bot.spec.ts` changes only `content_proposals` and
 * `per_run_user_cap` and restores them in `finally`; `enabled`, `dry_run` and the token belong to
 * 6.8's `bot-api.spec.ts`. Only types are imported from `lib/`.
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
