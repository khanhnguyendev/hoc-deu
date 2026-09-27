/**
 * `/review` reads for `e2e/review.spec.ts` (task 5.3): the due `item_state` rows other specs seed
 * with `seedItemStates` (`plans.ts`) and the read-back after grading a card, with the local
 * stack's secret key (like `check-in.ts`). Read-only: cleanup deletes users (`deleteTestUser`),
 * never a plan or an item state (decision 35 of M4). Only types are imported from `lib/`.
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

export type StoredItemState = {
  status: string
  level: number
  weak: boolean
  due_on: string | null
}

/** The learner's `item_state` row of `itemId`, or null — after grading a card, its new `due_on`. */
export async function itemStateOf(userId: string, itemId: string): Promise<StoredItemState | null> {
  const { data, error } = await admin()
    .from('item_state')
    .select('status, level, weak, due_on')
    .eq('user_id', userId)
    .eq('item_id', itemId)
    .maybeSingle()
  if (error) throw new Error(`itemStateOf(${itemId}) failed: ${error.message}`)
  return data
}
