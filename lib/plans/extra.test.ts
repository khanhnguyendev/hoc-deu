import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CATALOG, itemState } from '@/lib/domain/plan/__tests__/fixtures'
import { EXTRA_MAX_ITEMS } from '@/lib/domain/plan/extra'
import type { PlanBlock } from '@/lib/domain/plan/types'
import { deriveEventId } from '@/lib/events/ids'
import { EXTRA_ITEM_IDS } from '@/lib/events/plans'
import type { FakeRows, FakeSupabase } from '@/lib/testing/fake-supabase'
import { env, resetEnv } from './__tests__/env'
import { planEventStore, type PlanEventStep } from './__tests__/extra-store'
import {
  blockStateRow,
  itemStateRow,
  NOW,
  OTHER_USER_ID,
  planBlock,
  planRow,
  scheduleRow,
  SNAPSHOT,
  TODAY,
  trackRow,
  USER_ID,
  YESTERDAY,
} from './__tests__/fixtures'
import { overrideRow, profileRow } from './__tests__/override-rows'

vi.mock('@/lib/auth/dal', async () => (await import('./__tests__/env')).dalMock)
vi.mock('@/lib/supabase/server', async () => (await import('./__tests__/env')).serverMock)
vi.mock('@/lib/supabase/admin', async () => (await import('./__tests__/env')).adminMock)
vi.mock('./catalog', async () => (await import('./__tests__/env')).catalogMock)

const { addExtraForTrack, attachOffPlan } = await import('./extra')

const REQUEST_ID = '3f2a1b0c-9d8e-4f7a-8b6c-5d4e3f2a1b0c'
const seen = (date: string) => `${date}T03:00:00.000Z`

/** Today's DSA new block: the first two queue items (lesson-arrays, p1). */
const todayNew = planBlock(TODAY, 'dsa', 'new', ['dsa:lesson-arrays', 'dsa:p1'])
const ENGLISH_SNAPSHOT = { ...SNAPSHOT, variant: '10w', newPerDay: 8 }

/** A learner of DSA and English (started long ago) with `rows`, and the plan events answered. */
function learner(rows: FakeRows = {}, script: readonly PlanEventStep[] = []): FakeSupabase {
  const fake = resetEnv({
    schedule_versions: [scheduleRow()],
    user_tracks: [
      trackRow('dsa', { start_date: '2026-09-01' }),
      trackRow('english', { start_date: '2026-09-01' }),
    ],
    ...rows,
  })
  planEventStore(fake, script)
  return fake
}

type ExtraCall = {
  client: string
  p_user_id: string
  p_event: {
    id: string
    type: string
    plan_id: string
    track_id: string
    local_day: string
    payload: { itemIds: string[] }
  }
  p_changes: { table: string; row: PlanBlock }[]
  p_expected: Record<string, number>
}

const extraCalls = (fake: FakeSupabase): ExtraCall[] =>
  fake
    .rpcs('apply_system_event')
    .filter((call) => (call.args.p_event as { type: string }).type === 'plan.extra_added')
    .map((call) => ({
      client: call.client,
      ...(call.args as unknown as Omit<ExtraCall, 'client'>),
    }))

const planOf = (fake: FakeSupabase, id: string) =>
  fake.tables.day_plans?.find((row) => row.id === id)
const blocksOf = (fake: FakeSupabase, id: string) =>
  (planOf(fake, id)?.blocks ?? []) as unknown as PlanBlock[]
const extraOf = (fake: FakeSupabase, id: string, trackId: string) =>
  blocksOf(fake, id).find((block) => block.kind === 'extra' && block.trackId === trackId)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})
afterEach(() => {
  vi.useRealTimers()
})

it('takes at most the SQL bound of items in one addition (ruling M5-R2)', () => {
  expect(EXTRA_MAX_ITEMS).toBe(EXTRA_ITEM_IDS.max)
})

describe('addExtraForTrack ("Học thêm", decision 20)', () => {
  const plan = planRow({
    date: TODAY,
    blocks: [todayNew],
    tracks: { dsa: SNAPSHOT, english: ENGLISH_SNAPSHOT },
    seenAt: seen(TODAY),
  })

  it("appends the track's next new item to today's extra block: one plan.extra_added", async () => {
    const fake = learner({ day_plans: [plan] })
    expect(await addExtraForTrack(USER_ID, 'dsa', REQUEST_ID, NOW)).toBe('added')
    const calls = extraCalls(fake)
    expect(calls).toHaveLength(1)
    const extra: PlanBlock = {
      id: `${TODAY}:dsa:extra:1`,
      trackId: 'dsa',
      kind: 'extra',
      estMinutes: 35,
      items: [{ itemId: 'dsa:p2', mode: 'new', minutes: 35 }],
    }
    expect(calls[0]).toEqual({
      client: 'admin',
      p_user_id: USER_ID,
      p_event: expect.objectContaining({
        id: deriveEventId(REQUEST_ID, `extra:${plan.id}:dsa`),
        type: 'plan.extra_added',
        plan_id: plan.id,
        track_id: 'dsa',
        local_day: TODAY,
        payload: { itemIds: ['dsa:p2'] },
      }),
      p_changes: [{ table: 'day_plan_block', row: extra }],
      p_expected: { [`day_plans:${TODAY}`]: 1 },
    })
    expect(extraOf(fake, plan.id, 'dsa')).toEqual(extra)
    expect(planOf(fake, plan.id)?.version).toBe(2)
  })

  it('English: cards until their minutes reach 10, appended after the extra block', async () => {
    const extra = planBlock(TODAY, 'english', 'extra', ['english:e1'], {
      estMinutes: 1.5,
      items: [{ itemId: 'english:e1', mode: 'new', minutes: 1.5 }],
    })
    const withExtra = { ...plan, blocks: [todayNew, extra] as unknown as typeof plan.blocks }
    const fake = learner({ day_plans: [withExtra] })
    expect(await addExtraForTrack(USER_ID, 'english', REQUEST_ID, NOW)).toBe('added')
    const [call] = extraCalls(fake)
    expect(call?.p_event.payload.itemIds).toEqual([
      'english:e2',
      'english:e3',
      'english:e4',
      'english:x1',
      'english:x2',
      'english:e5',
      'english:e6',
    ])
    expect(call?.p_changes[0]?.row.items[0]).toEqual(extra.items[0])
    expect(extraOf(fake, plan.id, 'english')?.items).toHaveLength(8)
  })

  it('retries a version_conflict on the reloaded plan (withRetry)', async () => {
    // Another tab adds DSA's p2 first: the retry reads version 2 and adds p3.
    const otherTab: PlanEventStep = () => {
      const row = env.fake.tables.day_plans?.[0]
      if (row === undefined) return
      const extra = planBlock(TODAY, 'dsa', 'extra', ['dsa:p2'], {
        estMinutes: 35,
        items: [{ itemId: 'dsa:p2', mode: 'new', minutes: 35 }],
      })
      Object.assign(row, { blocks: [todayNew, extra], version: 2 })
    }
    const fake = learner({ day_plans: [plan] }, [otherTab])
    expect(await addExtraForTrack(USER_ID, 'dsa', REQUEST_ID, NOW)).toBe('added')
    const calls = extraCalls(fake)
    expect(calls).toHaveLength(2)
    expect(calls[1]?.p_expected).toEqual({ [`day_plans:${TODAY}`]: 2 })
    expect(calls[1]?.p_event.payload.itemIds).toEqual(['dsa:p3'])
    expect(extraOf(fake, plan.id, 'dsa')?.items.map((item) => item.itemId)).toEqual([
      'dsa:p2',
      'dsa:p3',
    ])
  })

  it('[RF-2] twice with the same requestId: one addition, the second is a duplicate', async () => {
    const fake = learner({ day_plans: [plan] })
    expect(await addExtraForTrack(USER_ID, 'dsa', REQUEST_ID, NOW)).toBe('added')
    expect(await addExtraForTrack(USER_ID, 'dsa', REQUEST_ID, NOW)).toBe('added')
    const calls = extraCalls(fake)
    expect(calls).toHaveLength(2)
    expect(calls[1]?.p_event.id).toBe(calls[0]?.p_event.id)
    expect(fake.tables.events?.filter((row) => row.type === 'plan.extra_added')).toHaveLength(1)
    expect(extraOf(fake, plan.id, 'dsa')?.items.map((item) => item.itemId)).toEqual(['dsa:p2'])
    expect(planOf(fake, plan.id)?.version).toBe(2)
  })

  it('adds to the resumed plan on a resume day, for today (decision 32 of M4)', async () => {
    const old = planBlock(YESTERDAY, 'dsa', 'new', ['dsa:lesson-arrays', 'dsa:p1'])
    const resumed = planRow({
      date: YESTERDAY,
      blocks: [old],
      tracks: { dsa: SNAPSHOT },
      seenAt: seen(YESTERDAY),
    })
    const fake = learner({
      day_plans: [resumed],
      plan_block_state: [blockStateRow(resumed, old, 'done', TODAY)],
    })
    expect(await addExtraForTrack(USER_ID, 'dsa', REQUEST_ID, NOW)).toBe('added')
    const [call] = extraCalls(fake)
    expect(call?.p_event).toMatchObject({ plan_id: resumed.id, local_day: TODAY })
    expect(call?.p_changes[0]?.row.id).toBe(`${YESTERDAY}:dsa:extra:1`)
  })

  it('answers no_plan in the paused view (the gate is closed), writing nothing', async () => {
    const old = planBlock(YESTERDAY, 'dsa', 'new', ['dsa:p1'])
    const paused = planRow({ date: YESTERDAY, blocks: [old], seenAt: seen(YESTERDAY) })
    const fake = learner({ day_plans: [paused] })
    expect(await addExtraForTrack(USER_ID, 'dsa', REQUEST_ID, NOW)).toBe('no_plan')
    expect(fake.rpcs()).toEqual([])
  })

  it("answers no_plan before today's plan exists (it builds nothing)", async () => {
    const fake = learner()
    expect(await addExtraForTrack(USER_ID, 'dsa', REQUEST_ID, NOW)).toBe('no_plan')
    expect(fake.rpcs()).toEqual([])
  })

  it("answers throttled when the plan's snapshot caps the track at 0 new items", async () => {
    const throttled = planRow({
      date: TODAY,
      blocks: [todayNew],
      tracks: {
        dsa: SNAPSHOT,
        english: { ...ENGLISH_SNAPSHOT, dueCount: 61, newPerDay: 0, throttled: true },
      },
      seenAt: seen(TODAY),
    })
    const fake = learner({ day_plans: [throttled] })
    expect(await addExtraForTrack(USER_ID, 'english', REQUEST_ID, NOW)).toBe('throttled')
    expect(fake.rpcs()).toEqual([])
  })

  it('answers nothing_to_add when every new item of the track is introduced', async () => {
    const states = Object.values(CATALOG.items)
      .filter((item) => item.trackId === 'english')
      .map((item) => itemStateRow(itemState(item.id, '2026-09-20')))
    const fake = learner({ day_plans: [plan], item_state: states })
    expect(await addExtraForTrack(USER_ID, 'english', REQUEST_ID, NOW)).toBe('nothing_to_add')
    expect(fake.rpcs()).toEqual([])
  })

  it('adds nothing to a track in an active extra week (§5.12, task 6.6c)', async () => {
    const fake = learner({
      day_plans: [plan],
      profiles: [profileRow()],
      roadmap_overrides: [overrideRow('extra_week', { start_local_day: TODAY })],
    })
    expect(await addExtraForTrack(USER_ID, 'dsa', REQUEST_ID, NOW)).toBe('nothing_to_add')
    expect(fake.rpcs()).toEqual([])
  })

  it('throws, reading nothing, when userId is not the signed-in user (decision 5)', async () => {
    const fake = learner({ day_plans: [plan] })
    await expect(addExtraForTrack(OTHER_USER_ID, 'dsa', REQUEST_ID, NOW)).rejects.toThrow()
    expect(fake.calls).toEqual([])
  })
})

describe('attachOffPlan (off-plan study, decision 21)', () => {
  const plan = planRow({
    date: TODAY,
    blocks: [todayNew],
    tracks: { dsa: SNAPSHOT },
    seenAt: seen(TODAY),
  })

  it("appends the item to today's extra block and answers where it landed", async () => {
    const fake = learner({ day_plans: [plan] })
    expect(await attachOffPlan(USER_ID, 'dsa:p6', 'new', REQUEST_ID, NOW)).toEqual({
      planId: plan.id,
      blockId: `${TODAY}:dsa:extra:1`,
    })
    const [call, ...others] = extraCalls(fake)
    expect(others).toEqual([])
    expect(call).toMatchObject({
      client: 'admin',
      p_event: {
        id: deriveEventId(REQUEST_ID, `offplan:${plan.id}:dsa:p6`),
        plan_id: plan.id,
        track_id: 'dsa',
        local_day: TODAY,
        payload: { itemIds: ['dsa:p6'] },
      },
      p_expected: { [`day_plans:${TODAY}`]: 1 },
    })
    expect(extraOf(fake, plan.id, 'dsa')).toEqual({
      id: `${TODAY}:dsa:extra:1`,
      trackId: 'dsa',
      kind: 'extra',
      estMinutes: 35,
      items: [{ itemId: 'dsa:p6', mode: 'new', minutes: 35 }],
    })
  })

  it('attaches in the given mode, with its minutes (a recalled problem: 5)', async () => {
    const fake = learner({ day_plans: [plan] })
    await attachOffPlan(USER_ID, 'dsa:p6', 'recall', REQUEST_ID, NOW)
    expect(extraOf(fake, plan.id, 'dsa')?.items).toEqual([
      { itemId: 'dsa:p6', mode: 'recall', minutes: 5 },
    ])
  })

  it('answers the block that already lists the item, adding nothing', async () => {
    const fake = learner({ day_plans: [plan] })
    expect(await attachOffPlan(USER_ID, 'dsa:p1', 'new', REQUEST_ID, NOW)).toEqual({
      planId: plan.id,
      blockId: todayNew.id,
    })
    expect(fake.rpcs()).toEqual([])
  })

  it('[RF-2] twice for one item: one addition (the second finds it in the extra block)', async () => {
    const fake = learner({ day_plans: [plan] })
    const first = await attachOffPlan(USER_ID, 'dsa:p6', 'new', REQUEST_ID, NOW)
    const second = await attachOffPlan(USER_ID, 'dsa:p6', 'new', REQUEST_ID, NOW)
    expect(second).toEqual(first)
    expect(extraCalls(fake)).toHaveLength(1)
    expect(extraOf(fake, plan.id, 'dsa')?.items).toHaveLength(1)
  })

  it('[RF-5] the gate closed: attaches to the paused plan, for today', async () => {
    const old = planBlock(YESTERDAY, 'dsa', 'new', ['dsa:p1'])
    const paused = planRow({ date: YESTERDAY, blocks: [old], seenAt: seen(YESTERDAY) })
    const fake = learner({ day_plans: [paused] })
    expect(await attachOffPlan(USER_ID, 'dsa:p6', 'new', REQUEST_ID, NOW)).toEqual({
      planId: paused.id,
      blockId: `${YESTERDAY}:dsa:extra:1`,
    })
    expect(extraCalls(fake)[0]?.p_event).toMatchObject({ plan_id: paused.id, local_day: TODAY })
    // No plan for today: the next plan comes tomorrow (§5.9).
    expect(fake.tables.day_plans?.map((row) => row.plan_date)).toEqual([YESTERDAY])
  })

  it("builds today's plan first when there is none (ensureToday), then attaches", async () => {
    const fake = learner()
    const placed = await attachOffPlan(USER_ID, 'dsa:p6', 'new', REQUEST_ID, NOW)
    const today = fake.tables.day_plans?.find((row) => row.plan_date === TODAY)
    expect(today).toBeDefined()
    expect(placed).toEqual({ planId: today?.id, blockId: `${TODAY}:dsa:extra:1` })
    expect(
      fake.rpcs('apply_system_event').map((call) => (call.args.p_event as { type: string }).type),
    ).toEqual(['plan.generated', 'plan.extra_added'])
  })

  it('answers null, writing nothing, without a plan to attach to (no active track)', async () => {
    const fake = resetEnv({
      schedule_versions: [scheduleRow()],
      user_tracks: [trackRow('dsa', { status: 'removed' })],
    })
    planEventStore(fake)
    expect(await attachOffPlan(USER_ID, 'dsa:p6', 'new', REQUEST_ID, NOW)).toBeNull()
    expect(fake.rpcs()).toEqual([])
  })

  it('answers null for an item the catalog does not have', async () => {
    const fake = learner({ day_plans: [plan] })
    expect(await attachOffPlan(USER_ID, 'dsa:nope', 'new', REQUEST_ID, NOW)).toBeNull()
    expect(fake.rpcs()).toEqual([])
  })

  it('retries a version_conflict on the reloaded plan', async () => {
    const fake = learner({ day_plans: [plan] }, ['version_conflict'])
    expect(await attachOffPlan(USER_ID, 'dsa:p6', 'new', REQUEST_ID, NOW)).toEqual({
      planId: plan.id,
      blockId: `${TODAY}:dsa:extra:1`,
    })
    expect(extraCalls(fake)).toHaveLength(2)
  })

  it('throws, reading nothing, when userId is not the signed-in user (decision 5)', async () => {
    const fake = learner({ day_plans: [plan] })
    env.sessionUserId = null
    await expect(attachOffPlan(USER_ID, 'dsa:p6', 'new', REQUEST_ID, NOW)).rejects.toThrow()
    expect(fake.calls).toEqual([])
  })
  describe('M-3 (ruling M5-R36): a track the paused view hides', () => {
    const old = planBlock(YESTERDAY, 'dsa', 'new', ['dsa:p1'])
    const english = planBlock(YESTERDAY, 'english', 'extra', ['english:e1'])
    const tracks = { dsa: SNAPSHOT, english: ENGLISH_SNAPSHOT }
    const paused = planRow({
      date: YESTERDAY,
      blocks: [old, english],
      tracks,
      seenAt: seen(YESTERDAY),
    })
    const enrolled = (status: 'active' | 'paused' | 'removed') => [
      trackRow('dsa', { start_date: '2026-09-01' }),
      trackRow('english', { start_date: '2026-09-01', status }),
    ]
    const fresh = `${YESTERDAY}:english:extra:2`

    it.each(['paused', 'removed'] as const)(
      'a %s track whose extra block holds an item not studied: a fresh extra block',
      async (status) => {
        const fake = learner({ day_plans: [paused], user_tracks: enrolled(status) })
        expect(await attachOffPlan(USER_ID, 'english:e2', 'new', REQUEST_ID, NOW)).toEqual({
          planId: paused.id,
          blockId: fresh,
        })
        const [call, ...others] = extraCalls(fake)
        expect(others).toEqual([])
        expect(call?.p_event).toMatchObject({
          id: deriveEventId(REQUEST_ID, `offplan:${paused.id}:english:e2`),
          plan_id: paused.id,
          track_id: 'english',
          local_day: TODAY,
          payload: { itemIds: ['english:e2'] },
        })
        expect(call?.p_changes[0]?.row).toEqual({
          id: fresh,
          trackId: 'english',
          kind: 'extra',
          estMinutes: 1.5,
          items: [{ itemId: 'english:e2', mode: 'new', minutes: 1.5 }],
        })
        expect(blocksOf(fake, paused.id).map((block) => block.id)).toEqual([
          old.id,
          english.id,
          fresh,
        ])
        // e2's result (recordOutcome records it next) finishes the fresh block: the track's next
        // card joins it, its latest extra block.
        ;(fake.tables.item_state ??= []).push(itemStateRow(itemState('english:e2', TODAY)))
        await attachOffPlan(USER_ID, 'english:e3', 'new', REQUEST_ID, NOW)
        expect(
          blocksOf(fake, paused.id)
            .at(-1)
            ?.items.map((item) => item.itemId),
        ).toEqual(['english:e2', 'english:e3'])
      },
    )

    it('a track still active appends to its extra block: the paused view lists it', async () => {
      const fake = learner({ day_plans: [paused], user_tracks: enrolled('active') })
      expect(await attachOffPlan(USER_ID, 'english:e2', 'new', REQUEST_ID, NOW)).toEqual({
        planId: paused.id,
        blockId: english.id,
      })
      expect(extraOf(fake, paused.id, 'english')?.items.map((item) => item.itemId)).toEqual([
        'english:e1',
        'english:e2',
      ])
    })

    it('every item of its extra block handled: appended, and its auto check-in follows', async () => {
      learner({
        day_plans: [paused],
        user_tracks: enrolled('paused'),
        item_state: [itemStateRow(itemState('english:e1', TODAY))],
      })
      expect(await attachOffPlan(USER_ID, 'english:e2', 'new', REQUEST_ID, NOW)).toEqual({
        planId: paused.id,
        blockId: english.id,
      })
    })

    it('its extra block checked in skipped by the learner: a fresh extra block', async () => {
      const fake = learner({
        day_plans: [paused],
        user_tracks: enrolled('paused'),
        item_state: [itemStateRow(itemState('english:e1', TODAY))],
        plan_block_state: [blockStateRow(paused, english, 'skipped', YESTERDAY)],
      })
      expect(await attachOffPlan(USER_ID, 'english:e2', 'new', REQUEST_ID, NOW)).toEqual({
        planId: paused.id,
        blockId: fresh,
      })
      expect(extraCalls(fake)).toHaveLength(1)
    })

    it("today's plan shows every block: appended, whatever the track", async () => {
      const todayExtra = planBlock(TODAY, 'english', 'extra', ['english:e1'])
      const today = planRow({ date: TODAY, blocks: [todayNew, todayExtra], tracks })
      const fake = learner({ day_plans: [today], user_tracks: enrolled('paused') })
      expect(await attachOffPlan(USER_ID, 'english:e2', 'new', REQUEST_ID, NOW)).toEqual({
        planId: today.id,
        blockId: todayExtra.id,
      })
      expect(fake.rpcs('apply_system_event')).toHaveLength(1)
    })
  })
})
