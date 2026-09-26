/**
 * Reads and seeds for the "Học thêm", off-plan study and "Bắt đầu lại" specs (task 5.4), with the
 * local stack's secret key like `plans.ts` (RLS bypassed). Cleanup deletes users
 * (`deleteTestUser`), never plans (decision 35 of M4). Only types are imported from `lib/`.
 */
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import type * as Supabase from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

// Same reason as e2e/support/users.ts: Node 22's ESM loader trips on @supabase/auth-js's
// circular CommonJS requires, so the client is required rather than imported.
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

export type StoredBlock = {
  id: string
  trackId: string
  kind: string
  estMinutes: number
  items: { itemId: string; mode: string; minutes: number }[]
}

export type StoredPlan = { id: string; version: number; blocks: StoredBlock[] }

/** The user's plan of `planDate` with its blocks, or null. */
export async function planOf(userId: string, planDate: string): Promise<StoredPlan | null> {
  const { data, error } = await admin()
    .from('day_plans')
    .select('id, version, blocks')
    .eq('user_id', userId)
    .eq('plan_date', planDate)
    .maybeSingle()
  if (error) throw new Error(`planOf(${planDate}) failed: ${error.message}`)
  return data === null
    ? null
    : { id: data.id, version: data.version, blocks: data.blocks as unknown as StoredBlock[] }
}

/** How many `item_state` rows the user has for `trackId`. */
export async function itemStateCount(userId: string, trackId: string): Promise<number> {
  const { count, error } = await admin()
    .from('item_state')
    .select('item_id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('track_id', trackId)
  if (error || count === null) {
    throw new Error(`itemStateCount(${trackId}) failed: ${error?.message ?? 'no count'}`)
  }
  return count
}

/**
 * Records an `item.result` event directly (the insert trigger forces `local_day` from
 * `occurred_at`), as if the learner had solved `itemId` `daysAgo` days ago — history a reset keeps.
 */
export async function seedResultEvent(
  userId: string,
  itemId: string,
  daysAgo: number,
): Promise<void> {
  const occurredAt = new Date(Date.now() - daysAgo * 86_400_000).toISOString()
  const { error } = await admin()
    .from('events')
    .insert({
      id: randomUUID(),
      user_id: userId,
      actor_id: userId,
      source: 'learner',
      type: 'item.result',
      occurred_at: occurredAt,
      local_day: occurredAt.slice(0, 10),
      track_id: itemId.split(':')[0]!,
      item_id: itemId,
      payload: { result: 'solved' },
    })
  if (error) throw new Error(`seedResultEvent(${itemId}) failed: ${error.message}`)
}
