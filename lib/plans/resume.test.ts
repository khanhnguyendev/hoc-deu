import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { itemState } from '@/lib/domain/plan/__tests__/fixtures'
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
  TODAY,
  trackRow,
  USER_ID,
  YESTERDAY,
} from './__tests__/fixtures'

vi.mock('@/lib/auth/dal', async () => (await import('./__tests__/env')).dalMock)
vi.mock('@/lib/supabase/server', async () => (await import('./__tests__/env')).serverMock)
vi.mock('@/lib/supabase/admin', async () => (await import('./__tests__/env')).adminMock)
vi.mock('./catalog', async () => (await import('./__tests__/env')).catalogMock)

const { resumeToday } = await import('./resume')

const STALE = '2026-09-25'
/** The stale plan's new block: a lesson introduced since, and two problems still new. */
const staleNew = planBlock(STALE, 'dsa', 'new', ['dsa:lesson-arrays', 'dsa:p1', 'dsa:p2'])
const staleReview = planBlock(STALE, 'dsa', 'review', ['dsa:p3'])

function learner(
  stale: { date: string; seenAt: string | null },
  rows: FakeRows = {},
): FakeSupabase {
  const fake = resetEnv({
    schedule_versions: [scheduleRow()],
    user_tracks: [trackRow('dsa'), trackRow('english')],
    day_plans: [
      planRow({ date: stale.date, blocks: [staleReview, staleNew], seenAt: stale.seenAt }),
    ],
    item_state: [itemStateRow(itemState('dsa:lesson-arrays', STALE))],
    ...rows,
  })
  planStore(fake)
  return fake
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})
afterEach(() => {
  vi.useRealTimers()
})

describe('resumeToday ("Học tiếp hôm nay", §5.8)', () => {
  it("stores today's resume plan with exactly the stale plan's not-introduced new items", async () => {
    const fake = learner({ date: STALE, seenAt: '2026-09-25T03:00:00Z' })
    expect(await resumeToday(USER_ID, NOW)).toBe('created')

    const [call, ...others] = storeCalls(fake)
    expect(others).toEqual([])
    expect(call).toMatchObject({
      client: 'admin',
      mode: 'resume',
      planDate: TODAY,
      expected: { [`day_plans:${TODAY}`]: 0 },
    })
    const newItems = (call?.blocks ?? [])
      .filter((block) => block.kind === 'new')
      .flatMap((block) => block.items.map((item) => item.itemId))
    expect(newItems).toEqual(['dsa:p1', 'dsa:p2'])
  })

  it('answers exists when the plan was created meanwhile (a double tap)', async () => {
    const fake = learner({ date: STALE, seenAt: '2026-09-25T03:00:00Z' })
    planStore(fake, [
      {
        data: { outcome: 'plan_exists', plan_id: planRow({ date: TODAY }).id, versions: {} },
        error: null,
      },
    ])
    expect(await resumeToday(USER_ID, NOW)).toBe('exists')
  })

  it("answers exists on a second, sequential tap (today's plan now exists)", async () => {
    const fake = learner({ date: STALE, seenAt: '2026-09-25T03:00:00Z' })
    expect(await resumeToday(USER_ID, NOW)).toBe('created')
    expect(await resumeToday(USER_ID, NOW)).toBe('exists')
    expect(storeCalls(fake)).toHaveLength(1)
  })

  it('retries a day_changed with a fresh clock', async () => {
    const fake = learner({ date: STALE, seenAt: '2026-09-25T03:00:00Z' })
    planStore(fake, ['day_changed'])
    expect(await resumeToday(USER_ID, NOW)).toBe('created')
    expect(storeCalls(fake)).toHaveLength(2)
  })

  it('is not offered while the stale plan is only 2 days old', async () => {
    const fake = learner({ date: '2026-09-26', seenAt: '2026-09-26T03:00:00Z' })
    expect(await resumeToday(USER_ID, NOW)).toBe('not_offered')
    expect(fake.rpcs()).toEqual([])
  })

  it('is not offered while the gate is open', async () => {
    const fake = learner({ date: STALE, seenAt: null })
    expect(await resumeToday(USER_ID, NOW)).toBe('not_offered')
    expect(fake.rpcs()).toEqual([])
  })

  it('is not offered on a resume day (resumedToday)', async () => {
    const stale = planRow({ date: YESTERDAY, blocks: [staleNew], seenAt: '2026-09-27T03:00:00Z' })
    const fake = learner(
      { date: STALE, seenAt: null },
      {
        day_plans: [stale],
        plan_block_state: [blockStateRow(stale, staleNew, 'done', TODAY)],
      },
    )
    expect(await resumeToday(USER_ID, NOW)).toBe('not_offered')
    expect(fake.rpcs()).toEqual([])
  })

  it("answers exists, writing nothing, when today's plan exists", async () => {
    const fake = learner({ date: STALE, seenAt: '2026-09-25T03:00:00Z' })
    fake.tables.day_plans?.push(planRow({ date: TODAY }))
    expect(await resumeToday(USER_ID, NOW)).toBe('exists')
    expect(fake.rpcs()).toEqual([])
  })

  it('throws, reading nothing, when userId is not the signed-in user (decision 5)', async () => {
    const fake = learner({ date: STALE, seenAt: '2026-09-25T03:00:00Z' })
    await expect(resumeToday(OTHER_USER_ID, NOW)).rejects.toThrow()
    env.sessionUserId = null
    await expect(resumeToday(USER_ID, NOW)).rejects.toThrow()
    expect(fake.calls).toEqual([])
  })
})
