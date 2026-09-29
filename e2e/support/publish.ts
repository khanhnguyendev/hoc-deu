/**
 * `content_publish_requests` rows for the publish specs (task 6.7a), written with the local stack's
 * secret key like `admin.ts`. The table is global and other specs (6.8) create requests in
 * parallel (Part B-M6 decision 23): a spec seeds a request for a target of its own and deletes
 * exactly that row (by id) in a `finally`. Only types are imported from `lib/`.
 */
import { randomUUID } from 'node:crypto'
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

/** A target no other spec uses and the catalog does not have: `e2e:publish-<8 hex>`. */
export const uniqueTarget = (): string => `e2e:publish-${randomUUID().slice(0, 8)}`

/** Inserts a pending request for `target` (no requester, no PR) and returns its id. */
export async function seedPublishRequest(target: string): Promise<number> {
  const { data, error } = await admin()
    .from('content_publish_requests')
    .insert({ target })
    .select('id')
    .single()
  if (error) throw new Error(`seedPublishRequest(${target}) failed: ${error.message}`)
  return data.id
}

/** Deletes one seeded request (never another spec's). */
export async function deletePublishRequest(id: number): Promise<void> {
  const { error } = await admin().from('content_publish_requests').delete().eq('id', id)
  if (error) throw new Error(`deletePublishRequest(${id}) failed: ${error.message}`)
}
