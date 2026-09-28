import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { RULES_VERSION } from '@/lib/domain/rules'
import type { Database } from '@/lib/supabase/database.types'
import { EventError } from './apply'
import { createUserItem, hideUserItem, retireUserItem } from './user-items'

const EVENT_ID = '0b8e5f5c-6f7a-4c8e-9a4b-2d6f1e3c9a10'
const USER_ID = '7d4c2b1a-3e5f-4a6b-8c9d-0e1f2a3b4c5d'
const ITEM_ID = 'user:0123456789abcdef:ah-card'
const DAY = '2026-09-28'

type RpcResult = { data: unknown; error: { message: string; code?: string } | null }

function fakeClient(result: RpcResult) {
  const calls: { fn: string; args: Record<string, unknown> }[] = []
  const client = {
    rpc: (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args })
      return Promise.resolve(result)
    },
  } as unknown as SupabaseClient<Database>
  return { client, calls }
}

const answer = (outcome: string): RpcResult => ({ data: { outcome, versions: {} }, error: null })
const failed = (message: string): RpcResult => ({ data: null, error: { message, code: 'P0001' } })

const CREATE = {
  eventId: EVENT_ID,
  runKey: 'run_2026-09-28',
  itemId: ITEM_ID,
  slug: 'ah-card',
  itemType: 'flashcard' as const,
  trackId: 'dsa',
  topicId: 'arrays-hashing',
  payload: { front: 'f', back: 'b', tags: [] },
  localDay: DAY,
  limits: { perDay: 10, active: 200 },
}

describe('createUserItem (§6.4.4, decisions 17, 33)', () => {
  it('sends user_item.created as the bot, with its row, the limits and the local day', async () => {
    const { client, calls } = fakeClient(answer('applied'))
    expect(await createUserItem(client, USER_ID, CREATE)).toBe('applied')
    expect(calls).toEqual([
      {
        fn: 'apply_system_event',
        args: {
          p_user_id: USER_ID,
          p_event: {
            id: EVENT_ID,
            type: 'user_item.created',
            source: 'bot',
            track_id: 'dsa',
            item_id: ITEM_ID,
            local_day: DAY,
            payload: { itemType: 'flashcard', slug: 'ah-card' },
            rules_version: RULES_VERSION,
            limits: { perDay: 10, active: 200 },
          },
          p_changes: [
            {
              table: 'user_items',
              row: {
                topic_id: 'arrays-hashing',
                payload: { front: 'f', back: 'b', tags: [] },
                created_by_run: 'run_2026-09-28',
              },
            },
          ],
          p_expected: {},
        },
      },
    ])
  })

  it('answers unchanged for the same slug and payload, applied for a replayed event id', async () => {
    expect(await createUserItem(fakeClient(answer('unchanged')).client, USER_ID, CREATE)).toBe(
      'unchanged',
    )
    expect(await createUserItem(fakeClient(answer('duplicate')).client, USER_ID, CREATE)).toBe(
      'applied',
    )
  })

  it.each(['ai_off', 'slug_taken', 'limit_reached', 'not_enrolled', 'day_changed'] as const)(
    'raises the database’s %s as an EventError',
    async (code) => {
      const promise = createUserItem(fakeClient(failed(code)).client, USER_ID, CREATE)
      await expect(promise).rejects.toBeInstanceOf(EventError)
      await expect(promise).rejects.toMatchObject({ code })
    },
  )

  it('an answer it does not know is unknown', async () => {
    await expect(
      createUserItem(fakeClient(answer('plan_exists')).client, USER_ID, CREATE),
    ).rejects.toMatchObject({ code: 'unknown' })
  })
})

describe('retireUserItem', () => {
  it('sends user_item.retired as the bot, with the stored type', async () => {
    const { client, calls } = fakeClient(answer('applied'))
    expect(
      await retireUserItem(client, USER_ID, {
        eventId: EVENT_ID,
        itemId: ITEM_ID,
        itemType: 'prompt',
        localDay: DAY,
      }),
    ).toBe('applied')
    expect(calls[0]?.args).toEqual({
      p_user_id: USER_ID,
      p_event: {
        id: EVENT_ID,
        type: 'user_item.retired',
        source: 'bot',
        item_id: ITEM_ID,
        local_day: DAY,
        payload: { itemType: 'prompt' },
        rules_version: RULES_VERSION,
      },
    })
  })

  it('answers unchanged for an item already retired', async () => {
    expect(
      await retireUserItem(fakeClient(answer('unchanged')).client, USER_ID, {
        eventId: EVENT_ID,
        itemId: ITEM_ID,
        itemType: 'flashcard',
        localDay: DAY,
      }),
    ).toBe('unchanged')
  })
})

describe('hideUserItem (the learner, §5.12)', () => {
  it('sends user_item.hidden as the system, the learner as the actor', async () => {
    const { client, calls } = fakeClient(answer('applied'))
    expect(
      await hideUserItem(client, USER_ID, {
        eventId: EVENT_ID,
        itemId: ITEM_ID,
        itemType: 'flashcard',
      }),
    ).toBe('applied')
    expect(calls[0]?.args).toEqual({
      p_user_id: USER_ID,
      p_event: {
        id: EVENT_ID,
        type: 'user_item.hidden',
        source: 'system',
        actor_id: USER_ID,
        item_id: ITEM_ID,
        payload: { itemType: 'flashcard' },
        rules_version: RULES_VERSION,
      },
    })
  })

  it('answers unchanged for an item already hidden, and raises invalid_transition', async () => {
    const input = { eventId: EVENT_ID, itemId: ITEM_ID, itemType: 'flashcard' as const }
    expect(await hideUserItem(fakeClient(answer('unchanged')).client, USER_ID, input)).toBe(
      'unchanged',
    )
    await expect(
      hideUserItem(fakeClient(failed('invalid_transition')).client, USER_ID, input),
    ).rejects.toMatchObject({ code: 'invalid_transition' })
  })
})
