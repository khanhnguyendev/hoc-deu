/**
 * Reads for the item-result specs (task 5.2c): the events a result recorded and the check-in the
 * server wrote for its block, read with the local stack's secret key like `plans.ts` (RLS
 * bypassed). Read-only: cleanup deletes users (`deleteTestUser`), never rows. Only types are
 * imported from `lib/`.
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

export type RecordedEvent = {
  type: string
  payload: unknown
  plan_id: string | null
  block_id: string | null
  source: string
}

/** The user's events about `itemId`, oldest first (of `type` when given). */
export async function itemEvents(
  userId: string,
  itemId: string,
  type?: string,
): Promise<RecordedEvent[]> {
  let query = admin()
    .from('events')
    .select('type, payload, plan_id, block_id, source')
    .eq('user_id', userId)
    .eq('item_id', itemId)
  if (type !== undefined) query = query.eq('type', type)
  const { data, error } = await query.order('occurred_at')
  if (error) throw new Error(`itemEvents(${userId}, ${itemId}) failed: ${error.message}`)
  return data
}

export type BlockCheckIn = { status: string; auto: boolean; minutes: number }

/** The block's `plan_block_state` row (its check-in), or null when it has none. */
export async function blockCheckIn(
  userId: string,
  planId: string,
  blockId: string,
): Promise<BlockCheckIn | null> {
  const { data, error } = await admin()
    .from('plan_block_state')
    .select('status, auto, minutes')
    .eq('user_id', userId)
    .eq('plan_id', planId)
    .eq('block_id', blockId)
    .maybeSingle()
  if (error) throw new Error(`blockCheckIn(${planId}, ${blockId}) failed: ${error.message}`)
  return data
}
