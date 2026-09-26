import { beforeEach, describe, expect, it, vi } from 'vitest'
import { blockKey } from '@/lib/domain/state'
import type { FakeRows } from '@/lib/testing/fake-supabase'
import { env, resetEnv } from './__tests__/env'
import {
  blockStateRow,
  OTHER_USER_ID,
  planBlock,
  planRow,
  storedOf,
  TODAY,
  trackRow,
  USER_ID,
  YESTERDAY,
} from './__tests__/fixtures'

vi.mock('@/lib/auth/dal', async () => (await import('./__tests__/env')).dalMock)
vi.mock('./catalog', async () => (await import('./__tests__/env')).catalogMock)

const { currentPlan } = await import('./current')

const ACTIVE: ReadonlySet<string> = new Set(['dsa', 'english'])
const dsaBlock = (date: string) => planBlock(date, 'dsa', 'new', ['dsa:p1'])
const seen = (date: string) => `${date}T03:00:00.000Z`

/** currentPlan on TODAY through the fake's session client; the `active` tracks are enrolled
 *  (started TODAY) unless `rows` has its own `user_tracks`. */
async function current(rows: FakeRows, active: ReadonlySet<string> = ACTIVE) {
  const fake = resetEnv({ user_tracks: [...active].map((trackId) => trackRow(trackId)), ...rows })
  const result = await currentPlan(fake.client('session'), USER_ID, TODAY, active)
  // It builds nothing: an rpc would throw (no handler).
  expect(fake.rpcs()).toEqual([])
  return result
}

beforeEach(() => {
  resetEnv()
})

describe('currentPlan (decision 13)', () => {
  it("is today's plan when it exists", async () => {
    const block = planBlock(TODAY, 'dsa', 'new', ['dsa:p1'])
    const today = planRow({ date: TODAY, blocks: [block] })
    const last = planRow({
      date: YESTERDAY,
      blocks: [dsaBlock(YESTERDAY)],
      seenAt: seen(YESTERDAY),
    })
    expect(
      await current({
        day_plans: [today, last],
        plan_block_state: [blockStateRow(today, block, 'done', TODAY)],
      }),
    ).toEqual({
      kind: 'today',
      plan: storedOf(today),
      blocks: { [blockKey(today.id, block.id)]: expect.objectContaining({ status: 'done' }) },
    })
  })

  it("is null when today's plan cannot be read (check-ins are refused as stale)", async () => {
    const today = planRow({ date: TODAY, blocks: [{ kind: 'mystery' }] })
    expect(await current({ day_plans: [today] })).toBeNull()
  })

  it('is the last seen plan while the gate is closed', async () => {
    const block = dsaBlock('2026-09-25')
    const last = planRow({ date: '2026-09-25', blocks: [block], seenAt: seen('2026-09-25') })
    expect(await current({ day_plans: [last] })).toEqual({
      kind: 'paused',
      plan: storedOf(last),
      blocks: {},
    })
  })

  it('is the last seen plan on a resume day (resumedToday)', async () => {
    const block = dsaBlock(YESTERDAY)
    const last = planRow({ date: YESTERDAY, blocks: [block], seenAt: seen(YESTERDAY) })
    expect(
      await current({
        day_plans: [last],
        plan_block_state: [blockStateRow(last, block, 'partial', TODAY)],
      }),
    ).toMatchObject({ kind: 'resumed', plan: storedOf(last) })
  })

  it("is null while the gate is open and today's plan is not built yet", async () => {
    const block = dsaBlock(YESTERDAY)
    const last = planRow({ date: YESTERDAY, blocks: [block], seenAt: seen(YESTERDAY) })
    expect(
      await current({
        day_plans: [last],
        plan_block_state: [blockStateRow(last, block, 'done', YESTERDAY)],
      }),
    ).toBeNull()
    expect(await current({})).toBeNull()
  })

  it("is null when the last seen plan holds only a removed track's blocks (M-5 A)", async () => {
    const last = planRow({
      date: '2026-09-25',
      blocks: [dsaBlock('2026-09-25')],
      seenAt: seen('2026-09-25'),
    })
    expect(await current({ day_plans: [last] }, new Set(['english']))).toBeNull()
  })

  it('is null when the last seen plan cannot be read (the gate is open)', async () => {
    const last = planRow({
      date: '2026-09-25',
      blocks: [{ kind: 'mystery' }],
      seenAt: seen('2026-09-25'),
    })
    expect(await current({ day_plans: [last] })).toBeNull()
  })

  describe('§5.4 step 3: a plan /today does not show gets no check-in', () => {
    const stale = () =>
      planRow({ date: '2026-09-25', blocks: [dsaBlock('2026-09-25')], seenAt: seen('2026-09-25') })

    it('is null while every active track starts later (notStarted), even with the gate closed', async () => {
      expect(
        await current({
          day_plans: [stale()],
          user_tracks: [
            trackRow('dsa', { start_date: '2026-10-01' }),
            trackRow('english', { start_date: '2026-10-05' }),
          ],
        }),
      ).toBeNull()
    })

    it('is the paused plan once one active track has started', async () => {
      expect(
        await current({
          day_plans: [stale()],
          user_tracks: [trackRow('dsa'), trackRow('english', { start_date: '2026-10-05' })],
        }),
      ).toMatchObject({ kind: 'paused' })
    })

    it('is null without an active enrollment (noTracks)', async () => {
      expect(
        await current(
          { day_plans: [stale()], user_tracks: [trackRow('dsa', { status: 'paused' })] },
          new Set(),
        ),
      ).toBeNull()
    })

    it("is still today's plan when it exists (step 2 comes first, as on /today)", async () => {
      const today = planRow({ date: TODAY, blocks: [planBlock(TODAY, 'dsa', 'new', ['dsa:p1'])] })
      expect(
        await current({
          day_plans: [today],
          user_tracks: [trackRow('dsa', { start_date: '2026-10-01' })],
        }),
      ).toMatchObject({ kind: 'today', plan: storedOf(today) })
    })
  })

  it('throws, reading nothing, when userId is not the signed-in user (decision 5)', async () => {
    const fake = resetEnv({ day_plans: [planRow({ date: TODAY })] })
    await expect(currentPlan(fake.client(), OTHER_USER_ID, TODAY, ACTIVE)).rejects.toThrow()
    env.sessionUserId = null
    await expect(currentPlan(fake.client(), USER_ID, TODAY, ACTIVE)).rejects.toThrow()
    expect(fake.calls).toEqual([])
  })
})
