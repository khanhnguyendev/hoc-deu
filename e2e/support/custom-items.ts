/**
 * Custom items for `e2e/custom-items.spec.ts` (task 6.6a), written with the local stack's secret
 * key like `users.ts`. They are seeded **directly into `user_items`**, not through
 * `apply_system_event('user_item.created')`: the database refuses the bot's writes while
 * `bot_settings.dry_run` is on (its seeded value), and only 6.8's `bot-api.spec.ts` may change
 * that global row (Part B-M6 decision 23). The rows are the ones `lib/bot/custom-items.ts` would
 * store (`parseCustomPayload`'s output). Cleanup deletes the users, whose cascade removes them.
 * Only types are imported from `lib/`.
 */
import { createRequire } from 'node:module'
import type * as Supabase from '@supabase/supabase-js'
import type { Database, Json } from '@/lib/supabase/database.types'

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

/** Turns the AI flag on for a test user (the spec's `finally` turns it off: `setAiFlagOff`). */
export async function setAiFlagOn(userId: string): Promise<void> {
  const { error } = await admin()
    .from('profiles')
    .update({ ai_personalization: true })
    .eq('id', userId)
  if (error) throw new Error(`setAiFlagOn(${userId}) failed: ${error.message}`)
}

export type SeedCard = {
  slug: string
  trackId: string
  topicId: string
  front: string
  back: string
}

/** Seeds active custom flashcards; returns their IDs (`user:<bot_ref>:<slug>`), in order. */
export async function seedCustomCards(
  userId: string,
  cards: readonly SeedCard[],
  createdOn: string,
): Promise<string[]> {
  const profile = await admin().from('profiles').select('bot_ref').eq('id', userId).single()
  if (profile.error) throw new Error(`read bot_ref of ${userId} failed: ${profile.error.message}`)
  const ids = cards.map((card) => `user:${profile.data.bot_ref}:${card.slug}`)
  const { error } = await admin()
    .from('user_items')
    .insert(
      cards.map((card, index) => ({
        user_id: userId,
        item_id: ids[index]!,
        item_type: 'flashcard',
        track_id: card.trackId,
        topic_id: card.topicId,
        payload: { front: card.front, back: card.back, tags: [] } as Json,
        created_by_run: 'run_2000-01-03',
        created_on: createdOn,
      })),
    )
  if (error) throw new Error(`seedCustomCards(${userId}) failed: ${error.message}`)
  return ids
}

/** The stored status of a custom item (`active`, `hidden`, `retired`), or null. */
export async function customItemStatus(userId: string, itemId: string): Promise<string | null> {
  const { data, error } = await admin()
    .from('user_items')
    .select('status')
    .eq('user_id', userId)
    .eq('item_id', itemId)
    .maybeSingle()
  if (error) throw new Error(`customItemStatus(${itemId}) failed: ${error.message}`)
  return data?.status ?? null
}
