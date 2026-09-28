/**
 * A learner's custom items in the database (platform design §4.1 `user_items`, §5.12, §6.4.4; Part
 * B-M6 decisions 17, 33; task 6.6a), through `apply_system_event` with the secret-key client:
 * `user_item.created` and `user_item.retired` are the bot's (`source: 'bot'`, after
 * `requireBotToken` and `resolveRunUser`), `user_item.hidden` is the learner's ("Ẩn" on the track
 * page's "Mục riêng" tab, after `requireOnboarded`: `source: 'system'`, the learner as the actor).
 * The database takes the per-user lock, checks the AI flag (the bot's two), the per-day and active
 * quotas (`limits`, clamped there to the hard maxima), the enrollment, the item's owner and type.
 *
 * `applied` — written (a replayed event id, `duplicate`, was written before: applied too);
 * `unchanged` — nothing to do (the same slug and payload again, an item already retired or
 * hidden); anything else is an `EventError` with the database's code (`ai_off`, `slug_taken`,
 * `limit_reached`, `not_enrolled`, `invalid_transition`, `day_changed`, …). Server-only.
 */
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { LocalDay } from '@/lib/domain/time/localDay'
import type { Database, Json } from '@/lib/supabase/database.types'
import { EventError, eventErrorOf, systemEventBody } from './apply'

type Client = SupabaseClient<Database>
type CustomItemType = 'flashcard' | 'exercise' | 'prompt'

export type UserItemWriteOutcome = 'applied' | 'unchanged'

function outcomeOf(data: Json | null, error: { message: string } | null): UserItemWriteOutcome {
  if (error) throw eventErrorOf(error)
  const outcome =
    data !== null && typeof data === 'object' && !Array.isArray(data) ? data.outcome : undefined
  if (outcome === 'applied' || outcome === 'duplicate') return 'applied'
  if (outcome === 'unchanged') return 'unchanged'
  throw new EventError('unknown')
}

/**
 * `user_item.created` (§6.4.4): `itemId` is the server's (`user:<bot_ref>:<slug>`, checked against
 * the profile under the lock), `payload` the validated payload to store (`parseCustomPayload`),
 * `localDay` the learner's day the quotas were counted for (`day_changed` when the request crossed
 * the day start), `limits` the effective `{ perDay, active }` (`effectiveLimits`).
 */
export async function createUserItem(
  admin: Client,
  userId: string,
  input: {
    readonly eventId: string
    readonly runKey: string
    readonly itemId: string
    readonly slug: string
    readonly itemType: CustomItemType
    readonly trackId: string
    readonly topicId: string
    readonly payload: Readonly<Record<string, unknown>>
    readonly localDay: LocalDay
    readonly limits: { readonly perDay: number; readonly active: number }
  },
): Promise<UserItemWriteOutcome> {
  const p_event = systemEventBody({
    id: input.eventId,
    type: 'user_item.created',
    source: 'bot',
    trackId: input.trackId,
    itemId: input.itemId,
    localDay: input.localDay,
    payload: { itemType: input.itemType, slug: input.slug },
  })
  p_event.limits = { perDay: input.limits.perDay, active: input.limits.active }
  const { data, error } = await admin.rpc('apply_system_event', {
    p_user_id: userId,
    p_event,
    p_changes: [
      {
        table: 'user_items',
        row: {
          topic_id: input.topicId,
          payload: input.payload as Json,
          created_by_run: input.runKey,
        },
      },
    ],
    p_expected: {},
  })
  return outcomeOf(data, error)
}

/** `user_item.retired` (§6.4.4): the user's own item, of its stored type. */
export async function retireUserItem(
  admin: Client,
  userId: string,
  input: {
    readonly eventId: string
    readonly itemId: string
    readonly itemType: CustomItemType
    readonly localDay: LocalDay
  },
): Promise<UserItemWriteOutcome> {
  const p_event = systemEventBody({
    id: input.eventId,
    type: 'user_item.retired',
    source: 'bot',
    itemId: input.itemId,
    localDay: input.localDay,
    payload: { itemType: input.itemType },
  })
  const { data, error } = await admin.rpc('apply_system_event', { p_user_id: userId, p_event })
  return outcomeOf(data, error)
}

/**
 * `user_item.hidden` (§5.12 "the learner can hide any item"; takes effect from the next plan,
 * §5.9): the learner's own active item, of its stored type. Only after `requireOnboarded`, for the
 * signed-in learner `userId`, who is the actor.
 */
export async function hideUserItem(
  admin: Client,
  userId: string,
  input: { readonly eventId: string; readonly itemId: string; readonly itemType: CustomItemType },
): Promise<UserItemWriteOutcome> {
  const p_event = systemEventBody({
    id: input.eventId,
    type: 'user_item.hidden',
    source: 'system',
    actorId: userId,
    itemId: input.itemId,
    payload: { itemType: input.itemType },
  })
  const { data, error } = await admin.rpc('apply_system_event', { p_user_id: userId, p_event })
  return outcomeOf(data, error)
}
