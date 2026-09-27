/**
 * Check-in reads for `e2e/check-in.spec.ts` (task 5.2b): the stored check-in, its events and the
 * `daily_activity` it counts for, read back with the local stack's secret key (like `plans.ts`).
 * Read-only: cleanup deletes users (`deleteTestUser`), never plans (decision 35 of M4). Only types
 * are imported from `lib/`.
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

export type StoredCheckIn = {
  status: string
  minutes: number
  note: string | null
  auto: boolean
  checked_in_on: string
}

/** The block's check-in (`plan_block_state`), or null. */
export async function checkInOf(
  userId: string,
  planId: string,
  blockId: string,
): Promise<StoredCheckIn | null> {
  const { data, error } = await admin()
    .from('plan_block_state')
    .select('status, minutes, note, auto, checked_in_on')
    .eq('user_id', userId)
    .eq('plan_id', planId)
    .eq('block_id', blockId)
    .maybeSingle()
  if (error) throw new Error(`checkInOf(${blockId}) failed: ${error.message}`)
  return data
}

export type CheckInEvent = { payload: Record<string, unknown>; local_day: string }

/** The block's `block.checked_in` events, oldest first. */
export async function checkInEventsOf(
  userId: string,
  planId: string,
  blockId: string,
): Promise<CheckInEvent[]> {
  const { data, error } = await admin()
    .from('events')
    .select('payload, local_day')
    .eq('user_id', userId)
    .eq('type', 'block.checked_in')
    .eq('plan_id', planId)
    .eq('block_id', blockId)
    .order('occurred_at')
  if (error) throw new Error(`checkInEventsOf(${blockId}) failed: ${error.message}`)
  return data.map((row) => ({
    payload: row.payload as Record<string, unknown>,
    local_day: row.local_day,
  }))
}

/** The user's `daily_activity` row of `localDay`, or null. */
export async function activityOf(
  userId: string,
  localDay: string,
): Promise<{ completed: boolean; minutes_by_track: unknown } | null> {
  const { data, error } = await admin()
    .from('daily_activity')
    .select('completed, minutes_by_track')
    .eq('user_id', userId)
    .eq('local_day', localDay)
    .maybeSingle()
  if (error) throw new Error(`activityOf(${localDay}) failed: ${error.message}`)
  return data
}
