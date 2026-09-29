import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import type { RoadmapOverride } from '@/lib/domain/plan/overrides'
import { RULES_VERSION } from '@/lib/domain/rules'
import type { Database } from '@/lib/supabase/database.types'
import { EventError } from './apply'
import { revokeOverride, setOverride } from './overrides'

const EVENT_ID = '0b8e5f5c-6f7a-4c8e-9a4b-2d6f1e3c9a10'
const USER_ID = '7d4c2b1a-3e5f-4a6b-8c9d-0e1f2a3b4c5d'
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

const INSERT: RoadmapOverride = {
  trackId: 'dsa',
  key: 'ah-extra-practice',
  kind: 'insert_block',
  params: { topicId: 'arrays-hashing', weekdays: ['mon', 'wed'], minutes: 15, until: '2026-10-05' },
  startLocalDay: DAY,
}
const EXTRA: RoadmapOverride = {
  trackId: 'dsa',
  key: 'ah-extra-week',
  kind: 'extra_week',
  params: { topicId: 'arrays-hashing', studyDays: 3 },
  startLocalDay: DAY,
  usedDays: 0,
}
const REORDER: RoadmapOverride = {
  trackId: 'dsa',
  key: 'trees-first',
  kind: 'reorder_topics',
  params: { order: ['trees', 'linked-list'] },
  startLocalDay: DAY,
}
const set = (override: RoadmapOverride) => ({
  eventId: EVENT_ID,
  runKey: 'run_2026-09-28',
  override,
  localDay: DAY,
  perTrack: 3,
})

describe('setOverride (§6.4.5, decisions 18, 33)', () => {
  it('sends roadmap.override_set as the bot: payload, row (until), limits and local day', async () => {
    const { client, calls } = fakeClient(answer('applied'))
    expect(await setOverride(client, USER_ID, set(INSERT))).toBe('applied')
    expect(calls).toEqual([
      {
        fn: 'apply_system_event',
        args: {
          p_user_id: USER_ID,
          p_event: {
            id: EVENT_ID,
            type: 'roadmap.override_set',
            source: 'bot',
            track_id: 'dsa',
            local_day: DAY,
            payload: { key: 'ah-extra-practice', kind: 'insert_block', params: INSERT.params },
            rules_version: RULES_VERSION,
            limits: { perTrack: 3 },
          },
          p_changes: [
            {
              table: 'roadmap_overrides',
              row: { until_local_day: '2026-10-05', created_by_run: 'run_2026-09-28' },
            },
          ],
          p_expected: {},
        },
      },
    ])
  })

  it('an extra week stores its study days; a reorder neither', async () => {
    const extra = fakeClient(answer('applied'))
    await setOverride(extra.client, USER_ID, set(EXTRA))
    expect((extra.calls[0]?.args.p_changes as { row: unknown }[])[0]?.row).toEqual({
      study_days: 3,
      created_by_run: 'run_2026-09-28',
    })
    expect((extra.calls[0]?.args.p_event as { payload: unknown }).payload).toEqual({
      key: 'ah-extra-week',
      kind: 'extra_week',
      params: { topicId: 'arrays-hashing', studyDays: 3 },
    })
    const reorder = fakeClient(answer('applied'))
    await setOverride(reorder.client, USER_ID, set(REORDER))
    expect((reorder.calls[0]?.args.p_changes as { row: unknown }[])[0]?.row).toEqual({
      created_by_run: 'run_2026-09-28',
    })
  })

  it('a duplicate event id is applied; the same override in force is unchanged', async () => {
    expect(await setOverride(fakeClient(answer('duplicate')).client, USER_ID, set(INSERT))).toBe(
      'applied',
    )
    expect(await setOverride(fakeClient(answer('unchanged')).client, USER_ID, set(INSERT))).toBe(
      'unchanged',
    )
  })

  it.each(['limit_reached', 'cooldown', 'revoked_key', 'not_enrolled', 'ai_off', 'day_changed'])(
    'the database’s %s is an EventError with that code',
    async (code) => {
      await expect(
        setOverride(fakeClient(failed(code)).client, USER_ID, set(INSERT)),
      ).rejects.toMatchObject({ name: 'EventError', code })
    },
  )
})

describe('revokeOverride (§5.9, §6.4.5; ruling M6-R17)', () => {
  it('the bot revokes with source bot', async () => {
    const { client, calls } = fakeClient(answer('applied'))
    expect(
      await revokeOverride(client, USER_ID, {
        eventId: EVENT_ID,
        trackId: 'dsa',
        key: 'trees-first',
        kind: 'reorder_topics',
        by: 'bot',
      }),
    ).toBe('applied')
    expect(calls[0]?.args).toEqual({
      p_user_id: USER_ID,
      p_event: {
        id: EVENT_ID,
        type: 'roadmap.override_revoked',
        source: 'bot',
        track_id: 'dsa',
        payload: { key: 'trees-first', kind: 'reorder_topics' },
        rules_version: RULES_VERSION,
      },
    })
  })

  it('the learner revokes with source system, as the actor', async () => {
    const { client, calls } = fakeClient(answer('applied'))
    await revokeOverride(client, USER_ID, {
      eventId: EVENT_ID,
      trackId: 'dsa',
      key: 'trees-first',
      kind: 'reorder_topics',
      by: 'learner',
    })
    expect(calls[0]?.args.p_event).toMatchObject({ source: 'system', actor_id: USER_ID })
  })

  it('revoked already → unchanged; an unknown key → invalid_event', async () => {
    const input = {
      eventId: EVENT_ID,
      trackId: 'dsa',
      key: 'x-key',
      kind: 'insert_block' as const,
      by: 'learner' as const,
    }
    expect(await revokeOverride(fakeClient(answer('unchanged')).client, USER_ID, input)).toBe(
      'unchanged',
    )
    const error = await revokeOverride(
      fakeClient(failed('invalid_event')).client,
      USER_ID,
      input,
    ).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(EventError)
    expect((error as EventError).code).toBe('invalid_event')
  })
})
