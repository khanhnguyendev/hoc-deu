import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import type { DayPlan, PlanBlock, TrackSnapshot } from '@/lib/domain/plan/types'
import { RULES_VERSION } from '@/lib/domain/rules'
import { vi as copy } from '@/lib/i18n/vi'
import type { Database } from '@/lib/supabase/database.types'
import { EventError, type EventErrorCode } from './apply'
import {
  storedPlanFromRow,
  storePlan,
  type DayPlanRow,
  type PlanWriteMode,
  type PlanWriteOutcome,
} from './plans'

const EVENT_ID = '0b8e5f5c-6f7a-4c8e-9a4b-2d6f1e3c9a10'
const USER_ID = '7d4c2b1a-3e5f-4a6b-8c9d-0e1f2a3b4c5d'
const PLAN_ID = '9f8e7d6c-5b4a-4c3d-8e2f-1a0b9c8d7e6f'
const DAY = '2026-09-28'

type RpcResult = { data: unknown; error: { message: string; code?: string } | null }

/** A client whose `rpc` records each call and answers with `result` (as in apply.test.ts). */
function fakeClient(result: RpcResult) {
  const calls: { fn: string; args: unknown }[] = []
  const client = {
    rpc: (fn: string, args: unknown) => {
      calls.push({ fn, args })
      return Promise.resolve(result)
    },
  } as unknown as SupabaseClient<Database>
  return { client, calls }
}

const answer = (data: unknown): RpcResult => ({ data, error: null })
const failed = (message: string, code = 'P0001'): RpcResult => ({
  data: null,
  error: { message, code },
})

const BLOCKS: readonly PlanBlock[] = [
  {
    id: `${DAY}:dsa:review:1`,
    trackId: 'dsa',
    kind: 'review',
    estMinutes: 10,
    items: [
      { itemId: 'dsa:lc-0001', mode: 'recall', minutes: 5 },
      { itemId: 'dsa:lc-0002', mode: 'recall', minutes: 5 },
    ],
  },
  {
    id: `${DAY}:dsa:new:1`,
    trackId: 'dsa',
    kind: 'new',
    estMinutes: 50,
    items: [{ itemId: 'dsa:lc-0003', mode: 'new', minutes: 50, overBudget: true }],
  },
  {
    id: `${DAY}:english:practice:1`,
    trackId: 'english',
    kind: 'practice',
    estMinutes: 3,
    items: [],
    tag: 'shadowing',
    shadowing: ['english:card-0001'],
  },
]

const DSA_SNAPSHOT: TrackSnapshot = {
  variant: '10w',
  week: 2,
  dueCount: 2,
  newPerDay: null,
  throttled: false,
  reviewDebt: false,
}
const TRACKS: Readonly<Record<string, TrackSnapshot>> = {
  dsa: DSA_SNAPSHOT,
  english: {
    variant: '10w',
    week: 1,
    dueCount: 45,
    newPerDay: 4,
    throttled: true,
    reviewDebt: false,
  },
}

const PLAN: DayPlan = Object.freeze({
  planDate: DAY,
  mode: 'baseline',
  blocks: BLOCKS,
  tracks: TRACKS,
})

async function eventError(promise: Promise<unknown>): Promise<EventError> {
  const error: unknown = await promise.then(
    () => undefined,
    (reason: unknown) => reason,
  )
  expect(error).toBeInstanceOf(EventError)
  return error as EventError
}

describe('storePlan (plan.generated through apply_system_event)', () => {
  it('sends a baseline plan: the row, payload { mode, planVersion 1 }, local_day and p_expected 0', async () => {
    const { client, calls } = fakeClient(
      answer({ outcome: 'applied', plan_id: PLAN_ID, versions: { [`day_plans:${DAY}`]: 1 } }),
    )
    await expect(
      storePlan(client, USER_ID, {
        eventId: EVENT_ID,
        plan: PLAN,
        mode: 'baseline',
        expectedVersion: 0,
      }),
    ).resolves.toEqual({ outcome: 'applied', planId: PLAN_ID })
    expect(calls).toEqual([
      {
        fn: 'apply_system_event',
        args: {
          p_user_id: USER_ID,
          p_event: {
            id: EVENT_ID,
            type: 'plan.generated',
            local_day: DAY,
            payload: { mode: 'baseline', planVersion: 1 },
            rules_version: RULES_VERSION,
          },
          p_changes: [
            { table: 'day_plans', row: { plan_date: DAY, blocks: BLOCKS, roadmap_weeks: TRACKS } },
          ],
          p_expected: { [`day_plans:${DAY}`]: 0 },
        },
      },
    ])
  })

  it('sends a resume as mode resume, planVersion 1, expected 0', async () => {
    const { client, calls } = fakeClient(answer({ outcome: 'applied', plan_id: PLAN_ID }))
    await storePlan(client, USER_ID, {
      eventId: EVENT_ID,
      plan: { ...PLAN, mode: 'resume' },
      mode: 'resume',
      expectedVersion: 0,
    })
    expect(calls[0]?.args).toMatchObject({
      p_event: { local_day: DAY, payload: { mode: 'resume', planVersion: 1 } },
      p_expected: { [`day_plans:${DAY}`]: 0 },
    })
  })

  it('sends a rebuild of version n as planVersion n + 1, expected n', async () => {
    const { client, calls } = fakeClient(answer({ outcome: 'applied', plan_id: PLAN_ID }))
    await storePlan(client, USER_ID, {
      eventId: EVENT_ID,
      plan: PLAN,
      mode: 'rebuild',
      expectedVersion: 2,
    })
    expect(calls[0]?.args).toMatchObject({
      p_event: { local_day: DAY, payload: { mode: 'rebuild', planVersion: 3 } },
      p_expected: { [`day_plans:${DAY}`]: 2 },
    })
  })

  // Decision 10 (final review M-3): every plan is built for today, so its planDate is the local
  // day the caller computed. A request that crosses the day start gets day_changed from the
  // database instead of storing yesterday's plan on today.
  it.each<PlanWriteMode>(['baseline', 'resume', 'rebuild'])(
    'sends local_day = the plan date with a %s plan',
    async (mode) => {
      const { client, calls } = fakeClient(answer({ outcome: 'applied', plan_id: PLAN_ID }))
      await storePlan(client, USER_ID, {
        eventId: EVENT_ID,
        plan: { ...PLAN, planDate: '2026-10-01' },
        mode,
        expectedVersion: mode === 'rebuild' ? 1 : 0,
      })
      expect(calls[0]?.args).toMatchObject({ p_event: { local_day: '2026-10-01' } })
    },
  )

  it.each<[PlanWriteOutcome, string | null]>([
    ['applied', PLAN_ID],
    ['plan_exists', PLAN_ID],
    ['plan_in_use', PLAN_ID],
  ])('maps the outcome %s with its plan_id', async (outcome, planId) => {
    const { client } = fakeClient(answer({ outcome, plan_id: PLAN_ID, versions: {} }))
    await expect(
      storePlan(client, USER_ID, {
        eventId: EVENT_ID,
        plan: PLAN,
        mode: 'rebuild',
        expectedVersion: 1,
      }),
    ).resolves.toEqual({ outcome, planId })
  })

  it('maps duplicate (the event id was already recorded) to a null planId', async () => {
    const { client } = fakeClient(answer({ outcome: 'duplicate', versions: {} }))
    await expect(
      storePlan(client, USER_ID, {
        eventId: EVENT_ID,
        plan: PLAN,
        mode: 'baseline',
        expectedVersion: 0,
      }),
    ).resolves.toEqual({ outcome: 'duplicate', planId: null })
  })

  it.each([
    { outcome: 'maybe', plan_id: PLAN_ID },
    { outcome: 'applied' },
    { outcome: 'plan_exists', plan_id: 7 },
    null,
    [],
  ])('treats the response %j as unknown', async (data) => {
    const { client } = fakeClient(answer(data))
    const error = await eventError(
      storePlan(client, USER_ID, {
        eventId: EVENT_ID,
        plan: PLAN,
        mode: 'baseline',
        expectedVersion: 0,
      }),
    )
    expect(error.code).toBe('unknown')
  })

  it.each<[EventErrorCode, string]>([
    ['version_conflict', copy.errors.saveFailed],
    ['day_changed', copy.errors.saveFailed],
    ['invalid_event', copy.errors.saveFailed],
    ['inactive', copy.errors.notAllowed],
    ['id_conflict', copy.errors.saveFailed],
  ])('maps the RPC error %s to an EventError', async (code, userMessage) => {
    const { client } = fakeClient(failed(code, code === 'inactive' ? '42501' : 'P0001'))
    const error = await eventError(
      storePlan(client, USER_ID, {
        eventId: EVENT_ID,
        plan: PLAN,
        mode: 'rebuild',
        expectedVersion: 1,
      }),
    )
    expect(error.code).toBe(code)
    expect(error.userMessage).toBe(userMessage)
  })

  it('maps the 128 KB check constraint error to unknown', async () => {
    const { client } = fakeClient(
      failed(
        'new row for relation "day_plans" violates check constraint "day_plans_blocks_check"',
        '23514',
      ),
    )
    const error = await eventError(
      storePlan(client, USER_ID, {
        eventId: EVENT_ID,
        plan: PLAN,
        mode: 'baseline',
        expectedVersion: 0,
      }),
    )
    expect(error.code).toBe('unknown')
  })

  it.each<[string, 'baseline' | 'resume' | 'rebuild', number]>([
    ['a baseline expecting a plan', 'baseline', 1],
    ['a resume expecting a plan', 'resume', 2],
    ['a rebuild expecting no plan', 'rebuild', 0],
    ['a fractional version', 'rebuild', 1.5],
    ['a negative version', 'rebuild', -1],
  ])('rejects %s before calling the database', async (_, mode, expectedVersion) => {
    const { client, calls } = fakeClient(answer({ outcome: 'applied', plan_id: PLAN_ID }))
    const error = await eventError(
      storePlan(client, USER_ID, { eventId: EVENT_ID, plan: PLAN, mode, expectedVersion }),
    )
    expect(error.code).toBe('invalid_event')
    expect(calls).toEqual([])
  })
})

describe('storedPlanFromRow', () => {
  const ROW: DayPlanRow = {
    id: PLAN_ID,
    user_id: USER_ID,
    plan_date: DAY,
    source: 'baseline',
    version: 2,
    blocks: JSON.parse(JSON.stringify(BLOCKS)) as DayPlanRow['blocks'],
    roadmap_weeks: JSON.parse(JSON.stringify(TRACKS)) as DayPlanRow['roadmap_weeks'],
    rules_version: RULES_VERSION,
    seen_at: '2026-09-28T01:02:03.000Z',
    created_at: '2026-09-27T21:00:00.000Z',
    updated_at: '2026-09-27T21:05:00.000Z',
  }

  it('parses a valid row into a StoredPlan', () => {
    expect(storedPlanFromRow(ROW)).toEqual({
      id: PLAN_ID,
      planDate: DAY,
      version: 2,
      source: 'baseline',
      seenAt: '2026-09-28T01:02:03.000Z',
      blocks: BLOCKS,
      tracks: TRACKS,
    })
  })

  it('keeps source ai and a null seen_at', () => {
    expect(storedPlanFromRow({ ...ROW, source: 'ai', seen_at: null })).toMatchObject({
      source: 'ai',
      seenAt: null,
    })
  })

  it('accepts an empty plan', () => {
    expect(storedPlanFromRow({ ...ROW, blocks: [], roadmap_weeks: {} })).toMatchObject({
      blocks: [],
      tracks: {},
    })
  })

  it.each<[string, DayPlanRow['blocks']]>([
    ['blocks that are not an array', { id: 'b' }],
    ['a block without an id', [{ trackId: 'dsa', kind: 'review', estMinutes: 5, items: [] }]],
    [
      'a block of an unknown kind',
      [{ id: 'b', trackId: 'dsa', kind: 'bonus', estMinutes: 5, items: [] }],
    ],
    [
      'a block with an unknown key',
      [{ id: 'b', trackId: 'dsa', kind: 'review', estMinutes: 5, items: [], extra: 1 }],
    ],
    [
      'an item with an unknown mode',
      [
        {
          id: 'b',
          trackId: 'dsa',
          kind: 'review',
          estMinutes: 5,
          items: [{ itemId: 'dsa:lc-0001', mode: 'skim', minutes: 5 }],
        },
      ],
    ],
    ['null blocks', null],
  ])('returns null for %s', (_, blocks) => {
    expect(storedPlanFromRow({ ...ROW, blocks })).toBeNull()
  })

  it.each<[string, DayPlanRow['roadmap_weeks']]>([
    ['roadmap_weeks that are not an object', []],
    ['a snapshot with a null week', { dsa: { ...DSA_SNAPSHOT, week: null } }],
    ['a snapshot with a string dueCount', { dsa: { ...DSA_SNAPSHOT, dueCount: '2' } }],
  ])('returns null for %s', (_, roadmapWeeks) => {
    expect(storedPlanFromRow({ ...ROW, roadmap_weeks: roadmapWeeks })).toBeNull()
  })

  it('returns null for a source the check constraint does not allow', () => {
    expect(storedPlanFromRow({ ...ROW, source: 'bot' })).toBeNull()
  })
})
