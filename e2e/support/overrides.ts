/**
 * Roadmap overrides for `e2e/overrides.spec.ts` (task 6.6c), written with the local stack's
 * secret key like `users.ts`. They are seeded **directly into `roadmap_overrides`**, not through
 * `apply_system_event('roadmap.override_set')`: the database refuses the bot's writes while
 * `bot_settings.dry_run` is on (its seeded value), and only 6.8's `bot-api.spec.ts` may change
 * that global row (Part B-M6 decision 23) — the same reason as `custom-items.ts`. The row is the
 * one `apply_system_event` would store. Cleanup deletes the users, whose cascade removes it. Only
 * types are imported from `lib/`.
 */
import { createRequire } from 'node:module'
import type * as Supabase from '@supabase/supabase-js'
import type { Database, Json } from '@/lib/supabase/database.types'

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

/** An active `insert_block` of `trackId` started `startLocalDay`. */
export async function seedInsertBlock(
  userId: string,
  block: {
    key: string
    trackId: string
    topicId: string
    weekdays: string[]
    minutes: number
    until: string
    startLocalDay: string
  },
): Promise<void> {
  const { error } = await admin()
    .from('roadmap_overrides')
    .insert({
      user_id: userId,
      track_id: block.trackId,
      key: block.key,
      kind: 'insert_block',
      params: {
        topicId: block.topicId,
        weekdays: block.weekdays,
        minutes: block.minutes,
        until: block.until,
      } as Json,
      until_local_day: block.until,
      start_local_day: block.startLocalDay,
      created_by_run: 'run_2000-01-06',
    })
  if (error) throw new Error(`seedInsertBlock(${userId}) failed: ${error.message}`)
}

/** The stored status and `revoked_by` of an override, or null. */
export async function overrideState(
  userId: string,
  trackId: string,
  key: string,
): Promise<{ status: string; revoked_by: string | null } | null> {
  const { data, error } = await admin()
    .from('roadmap_overrides')
    .select('status, revoked_by')
    .eq('user_id', userId)
    .eq('track_id', trackId)
    .eq('key', key)
    .maybeSingle()
  if (error) throw new Error(`overrideState(${key}) failed: ${error.message}`)
  return data
}

/** The practice-block tags of the user's plan of `planDate` (null when there is none). */
export async function planTags(userId: string, planDate: string): Promise<string[] | null> {
  const { data, error } = await admin()
    .from('day_plans')
    .select('blocks')
    .eq('user_id', userId)
    .eq('plan_date', planDate)
    .maybeSingle()
  if (error) throw new Error(`planTags(${planDate}) failed: ${error.message}`)
  if (data === null) return null
  return (data.blocks as { tag?: string }[]).flatMap((block) => (block.tag ? [block.tag] : []))
}
