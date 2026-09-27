/**
 * `daily_activity` rows for `/progress` (task 5.5): every test seeds its own rows through the
 * local stack's admin API, then only deletes the user (decision 35 of M4) — `daily_activity`
 * cascades with the user, like every other per-learner table.
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

export type DailyActivityRow = {
  localDay: string
  minutesByTrack: Record<string, number>
  itemsDone?: number
  completed?: boolean
}

/** Inserts `daily_activity` rows directly (secret key), as the derived-state projection would. */
export async function seedDailyActivity(userId: string, days: DailyActivityRow[]): Promise<void> {
  const { error } = await admin()
    .from('daily_activity')
    .insert(
      days.map((day) => ({
        user_id: userId,
        local_day: day.localDay,
        minutes_by_track: day.minutesByTrack,
        items_done: day.itemsDone ?? 0,
        completed: day.completed ?? false,
      })),
    )
  if (error) throw new Error(`seedDailyActivity(${userId}) failed: ${error.message}`)
}
