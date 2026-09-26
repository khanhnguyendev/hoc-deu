import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { itemState } from '@/lib/domain/plan/__tests__/fixtures'
import type { DayPlan } from '@/lib/domain/plan/types'
import { blockKey } from '@/lib/domain/state'
import type { Json } from '@/lib/supabase/database.types'
import type { FakeRows, FakeSupabase } from '@/lib/testing/fake-supabase'
import { env, resetEnv } from './__tests__/env'
import {
  blockStateRow,
  itemStateRow,
  NOW,
  OTHER_USER_ID,
  planBlock,
  planRow,
  planStore,
  scheduleRow,
  storeCalls,
  storedOf,
  TODAY,
  trackRow,
  USER_ID,
  YESTERDAY,
} from './__tests__/fixtures'

vi.mock('@/lib/auth/dal', async () => (await import('./__tests__/env')).dalMock)
vi.mock('@/lib/supabase/server', async () => (await import('./__tests__/env')).serverMock)
vi.mock('@/lib/supabase/admin', async () => (await import('./__tests__/env')).adminMock)
vi.mock('./catalog', async () => (await import('./__tests__/env')).catalogMock)
vi.mock('@/lib/domain/plan/buildPlan', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/domain/plan/buildPlan')>()
  const { env: mocked } = await import('./__tests__/env')
  return {
    ...actual,
    buildPlan: (ctx: Parameters<typeof actual.buildPlan>[0]): DayPlan => {
      const plan = actual.buildPlan(ctx)
      return mocked.stubPlan === null ? plan : mocked.stubPlan(plan)
    },
  }
})

const { ensureToday } = await import('./today')

/** A learner with both tracks active from TODAY, in Ho Chi Minh with a 04:00 day start. */
function learner(rows: FakeRows = {}): FakeSupabase {
  const fake = resetEnv({
    schedule_versions: [scheduleRow()],
    user_tracks: [trackRow('dsa'), trackRow('english')],
    ...rows,
  })
  planStore(fake)
  return fake
}

const trackIds = (blocks: readonly { trackId: string }[]) => [
  ...new Set(blocks.map((block) => block.trackId)),
]

beforeEach(() => {
  // Retries read a fresh clock (`new Date()`): pin it to NOW unless a test moves it.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})
afterEach(() => {
  vi.useRealTimers()
})

describe('ensureToday', () => {
  it("builds a new learner's plan once, with blocks for both tracks, then reads it back", async () => {
    const fake = learner()
    const first = await ensureToday(USER_ID, NOW)

    const [call, ...others] = storeCalls(fake)
    expect(others).toEqual([])
    expect(call).toMatchObject({
      client: 'admin',
      mode: 'baseline',
      planDate: TODAY,
      localDay: TODAY,
      expected: { [`day_plans:${TODAY}`]: 0 },
    })
    expect(trackIds(call?.blocks ?? [])).toEqual(['dsa', 'english'])
    expect(first.today).toBe(TODAY)
    expect(first.now).toBe(NOW.toISOString())
    if (first.state.kind !== 'plan') throw new Error('expected a plan')
    expect(first.state.blocks).toEqual({})
    expect(first.state.plan).toMatchObject({ planDate: TODAY, version: 1, seenAt: null })
    expect(first.state.plan.blocks).toEqual(call?.blocks)
    expect(first.enrollments.map((enrollment) => enrollment.trackId)).toEqual(['dsa', 'english'])
    expect(first.versions).toHaveLength(1)
    // Reads through the session client (RLS); only the plan write uses the secret key.
    expect(fake.selects().every((select) => select.client === 'session')).toBe(true)
    expect(fake.rpcs().every((rpc) => rpc.client === 'admin')).toBe(true)

    const second = await ensureToday(USER_ID, NOW)
    expect(storeCalls(fake)).toHaveLength(1)
    expect(second.state).toEqual(first.state)
  })

  it('returns the stored plan with its block states', async () => {
    const block = planBlock(TODAY, 'dsa', 'new', ['dsa:p1'])
    const row = planRow({ date: TODAY, blocks: [block], seenAt: '2026-09-28T02:00:00Z' })
    const fake = learner({
      day_plans: [row],
      plan_block_state: [blockStateRow(row, block, 'partial', TODAY)],
    })
    const { state } = await ensureToday(USER_ID, NOW)
    expect(state).toEqual({
      kind: 'plan',
      plan: storedOf(row),
      blocks: { [blockKey(row.id, block.id)]: expect.objectContaining({ status: 'partial' }) },
    })
    expect(fake.rpcs()).toEqual([])
  })

  it('shows notStarted with the earliest start date while every track starts later', async () => {
    const fake = learner({
      user_tracks: [
        trackRow('dsa', { start_date: '2026-10-05' }),
        trackRow('english', { start_date: '2026-10-01' }),
      ],
    })
    expect((await ensureToday(USER_ID, NOW)).state).toEqual({
      kind: 'notStarted',
      startDate: '2026-10-01',
    })
    expect(fake.rpcs()).toEqual([])
  })

  it('shows noTracks without an active track', async () => {
    const fake = learner({
      user_tracks: [
        trackRow('dsa', { status: 'paused' }),
        trackRow('english', { status: 'removed' }),
      ],
    })
    expect((await ensureToday(USER_ID, NOW)).state).toEqual({ kind: 'noTracks' })
    expect(fake.rpcs()).toEqual([])
  })

  describe('the gate (§5.2)', () => {
    const staleBlock = (date: string) => planBlock(date, 'dsa', 'new', ['dsa:p1', 'dsa:p2'])

    it('[RF-5] a seen plan 3 days old with no check-in: paused, offerResume, daysSince 3', async () => {
      const block = staleBlock('2026-09-25')
      const stale = planRow({ date: '2026-09-25', blocks: [block], seenAt: '2026-09-25T03:00:00Z' })
      const fake = learner({ day_plans: [stale] })
      expect((await ensureToday(USER_ID, NOW)).state).toEqual({
        kind: 'paused',
        plan: storedOf(stale),
        unfinished: [block],
        blocks: {},
        daysSince: 3,
        offerResume: true,
      })
      expect(fake.rpcs()).toEqual([])
    })

    it('[RF-5] a seen plan 2 days old: paused without the offer', async () => {
      const skipped = staleBlock('2026-09-26')
      const stale = planRow({
        date: '2026-09-26',
        blocks: [skipped],
        seenAt: '2026-09-26T03:00:00Z',
      })
      const fake = learner({
        day_plans: [stale],
        plan_block_state: [blockStateRow(stale, skipped, 'skipped', '2026-09-26')],
      })
      expect((await ensureToday(USER_ID, NOW)).state).toMatchObject({
        kind: 'paused',
        unfinished: [skipped],
        daysSince: 2,
        offerResume: false,
      })
      expect(fake.rpcs()).toEqual([])
    })

    it("M-5 A: the paused view lists only the active tracks' unfinished blocks", async () => {
      const dsa = staleBlock('2026-09-25')
      const english = planBlock('2026-09-25', 'english', 'new', ['english:e1'])
      const stale = planRow({
        date: '2026-09-25',
        blocks: [dsa, english],
        seenAt: '2026-09-25T03:00:00Z',
      })
      const fake = learner({
        day_plans: [stale],
        user_tracks: [trackRow('dsa', { status: 'removed' }), trackRow('english')],
      })
      expect((await ensureToday(USER_ID, NOW)).state).toMatchObject({
        kind: 'paused',
        unfinished: [english],
        daysSince: 3,
        offerResume: true,
      })
      expect(fake.rpcs()).toEqual([])
    })

    it("decision 32: yesterday's seen plan with a block done today is today's work — no new plan", async () => {
      const block = staleBlock(YESTERDAY)
      const last = planRow({ date: YESTERDAY, blocks: [block], seenAt: '2026-09-27T03:00:00Z' })
      const fake = learner({
        day_plans: [last],
        plan_block_state: [blockStateRow(last, block, 'done', TODAY)],
      })
      const { state } = await ensureToday(USER_ID, NOW)
      expect(state).toEqual({
        kind: 'resumed',
        plan: storedOf(last),
        blocks: { [blockKey(last.id, block.id)]: expect.objectContaining({ status: 'done' }) },
      })
      expect(fake.rpcs()).toEqual([])
    })

    it("builds today's plan when yesterday's seen plan has a block done yesterday", async () => {
      const block = staleBlock(YESTERDAY)
      const last = planRow({ date: YESTERDAY, blocks: [block], seenAt: '2026-09-27T03:00:00Z' })
      const fake = learner({
        day_plans: [last],
        plan_block_state: [blockStateRow(last, block, 'done', YESTERDAY)],
      })
      expect((await ensureToday(USER_ID, NOW)).state.kind).toBe('plan')
      expect(storeCalls(fake)).toHaveLength(1)
    })

    it("M-5 A: yesterday's seen plan with only a removed track's blocks does not hold the gate", async () => {
      const last = planRow({
        date: YESTERDAY,
        blocks: [staleBlock(YESTERDAY)],
        seenAt: '2026-09-27T03:00:00Z',
      })
      const fake = learner({
        day_plans: [last],
        user_tracks: [trackRow('dsa', { status: 'removed' }), trackRow('english')],
      })
      const { state } = await ensureToday(USER_ID, NOW)
      expect(state.kind).toBe('plan')
      const [call] = storeCalls(fake)
      expect(trackIds(call?.blocks ?? [])).toEqual(['english'])
    })

    it('an unreadable last seen plan counts as a plan without blocks: the gate is open', async () => {
      const unreadable = planRow({
        date: YESTERDAY,
        blocks: [{ ...staleBlock(YESTERDAY), kind: 'mystery' }],
        seenAt: '2026-09-27T03:00:00Z',
      })
      const fake = learner({ day_plans: [unreadable] })
      expect((await ensureToday(USER_ID, NOW)).state.kind).toBe('plan')
      expect(storeCalls(fake)).toHaveLength(1)
    })
  })

  describe('an unreadable plan for today (M-4, decision 10)', () => {
    const unreadable = () =>
      planRow({ date: TODAY, blocks: [{ id: 'x', kind: 'mystery' }], version: 3 })

    it('rebuilds it at its version while untouched, then shows it', async () => {
      const row = unreadable()
      const fake = learner({ day_plans: [row] })
      const { state } = await ensureToday(USER_ID, NOW)
      const [call, ...others] = storeCalls(fake)
      expect(others).toEqual([])
      expect(call).toMatchObject({ mode: 'rebuild', expected: { [`day_plans:${TODAY}`]: 3 } })
      expect(state).toMatchObject({ kind: 'plan', plan: { id: row.id, version: 4 } })
    })

    it('shows the unreadable state when the plan is in use', async () => {
      const row = unreadable()
      const fake = learner({
        day_plans: [row],
        plan_block_state: [blockStateRow(row, planBlock(TODAY, 'dsa', 'new', []), 'done', TODAY)],
      })
      expect((await ensureToday(USER_ID, NOW)).state).toEqual({ kind: 'unreadable' })
      expect(storeCalls(fake)).toHaveLength(1)
    })

    it('re-reads the plan once after a version_conflict (another request rebuilt it)', async () => {
      const row = unreadable()
      const fake = learner({ day_plans: [row] })
      const fixed = planBlock(TODAY, 'dsa', 'new', ['dsa:p1'])
      fake.onRpc('apply_system_event', () => {
        const stored = fake.tables.day_plans?.find((plan) => plan.id === row.id)
        if (stored === undefined) throw new Error('no row')
        stored.blocks = [fixed] as unknown as Json
        stored.version = 4
        return { data: null, error: { message: 'version_conflict' } }
      })
      const { state } = await ensureToday(USER_ID, NOW)
      expect(state).toMatchObject({
        kind: 'plan',
        plan: { id: row.id, version: 4, blocks: [fixed] },
      })
      expect(fake.rpcs()).toHaveLength(1)
    })

    it('shows the unreadable state when the rebuild fails', async () => {
      const fake = learner({ day_plans: [unreadable()] })
      planStore(fake, ['version_conflict'])
      expect((await ensureToday(USER_ID, NOW)).state).toEqual({ kind: 'unreadable' })
    })
  })

  describe('a request crossing the day start (decision 9, M4-R21)', () => {
    it("retries with a new clock when plan_exists answers with another day's plan", async () => {
      const yesterdays = planRow({ date: YESTERDAY })
      const fake = learner({ day_plans: [yesterdays] })
      planStore(fake, [
        { data: { outcome: 'plan_exists', plan_id: yesterdays.id, versions: {} }, error: null },
      ])
      // The next attempt reads the clock again: 2026-09-29 04:30 in Ho Chi Minh.
      vi.setSystemTime(new Date('2026-09-28T21:30:00.000Z'))

      const data = await ensureToday(USER_ID, NOW)
      expect(storeCalls(fake).map((call) => call.planDate)).toEqual([TODAY, '2026-09-29'])
      expect(data.today).toBe('2026-09-29')
      expect(data.now).toBe('2026-09-28T21:30:00.000Z')
      expect(data.state).toMatchObject({ kind: 'plan', plan: { planDate: '2026-09-29' } })
    })

    it('retries day_changed twice, then shows the plan', async () => {
      const fake = learner()
      planStore(fake, ['day_changed', 'day_changed'])
      expect((await ensureToday(USER_ID, NOW)).state.kind).toBe('plan')
      expect(storeCalls(fake)).toHaveLength(3)
    })

    it('throws after a third day_changed', async () => {
      const fake = learner()
      planStore(fake, ['day_changed', 'day_changed', 'day_changed'])
      await expect(ensureToday(USER_ID, NOW)).rejects.toThrow()
      expect(storeCalls(fake)).toHaveLength(3)
    })

    it('[RF-1] at 01:30 in Ho Chi Minh with day start 04:00, today is the previous date', async () => {
      const fake = learner()
      const data = await ensureToday(USER_ID, new Date('2026-09-28T18:30:00.000Z'))
      expect(data.today).toBe(TODAY)
      expect(storeCalls(fake).map((call) => call.planDate)).toEqual([TODAY])
    })
  })

  it('never stores a plan that fails planBlockSchema', async () => {
    const fake = learner()
    env.stubPlan = (plan) => ({
      ...plan,
      blocks: plan.blocks.map((block, index) =>
        index === 0 ? { ...block, estMinutes: 601 } : block,
      ),
    })
    await expect(ensureToday(USER_ID, NOW)).rejects.toThrow()
    expect(fake.rpcs()).toEqual([])
  })

  it('never stores a plan whose snapshot fails trackSnapshotSchema', async () => {
    const fake = learner()
    env.stubPlan = (plan) => ({
      ...plan,
      tracks: { ...plan.tracks, dsa: { ...plan.tracks.dsa!, week: 0 } },
    })
    await expect(ensureToday(USER_ID, NOW)).rejects.toThrow()
    expect(fake.rpcs()).toEqual([])
  })

  it('stores an empty plan like any plan (it keeps the gate open tomorrow, RF-4)', async () => {
    const fake = learner()
    env.stubPlan = (plan) => ({ ...plan, blocks: [] })
    const { state } = await ensureToday(USER_ID, NOW)
    expect(state).toMatchObject({ kind: 'plan', plan: { blocks: [] } })
    expect(storeCalls(fake)).toHaveLength(1)
  })

  it('passes the item states to the engine and returns them', async () => {
    const introduced = itemState('dsa:lesson-arrays', YESTERDAY)
    const fake = learner({ item_state: [itemStateRow(introduced)] })
    const data = await ensureToday(USER_ID, NOW)
    expect(data.items).toEqual({ 'dsa:lesson-arrays': introduced })
    const planned = storeCalls(fake)[0]?.blocks.flatMap((block) =>
      block.items.map((item) => item.itemId),
    )
    expect(planned).not.toContain('dsa:lesson-arrays')
  })

  it('throws, reading nothing, when userId is not the signed-in user (decision 5)', async () => {
    const fake = learner()
    await expect(ensureToday(OTHER_USER_ID, NOW)).rejects.toThrow()
    env.sessionUserId = null
    await expect(ensureToday(USER_ID, NOW)).rejects.toThrow()
    expect(fake.calls).toEqual([])
  })
})
