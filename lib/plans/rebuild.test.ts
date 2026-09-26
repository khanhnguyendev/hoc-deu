import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FakeSupabase } from '@/lib/testing/fake-supabase'
import { env, resetEnv } from './__tests__/env'
import {
  blockStateRow,
  eventRow,
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
} from './__tests__/fixtures'

vi.mock('@/lib/auth/dal', async () => (await import('./__tests__/env')).dalMock)
vi.mock('@/lib/supabase/server', async () => (await import('./__tests__/env')).serverMock)
vi.mock('@/lib/supabase/admin', async () => (await import('./__tests__/env')).adminMock)
vi.mock('./catalog', async () => (await import('./__tests__/env')).catalogMock)

const { ensureToday } = await import('./today')
const { rebuildTodayIfUntouched } = await import('./rebuild')

/** A learner whose baseline plan for TODAY was just built by ensureToday (version 1). */
async function withTodaysPlan(): Promise<FakeSupabase> {
  const fake = resetEnv({
    schedule_versions: [scheduleRow()],
    user_tracks: [trackRow('dsa'), trackRow('english')],
  })
  planStore(fake)
  await ensureToday(USER_ID, NOW)
  return fake
}

function setBudget(fake: FakeSupabase, trackId: string, minutes: number) {
  const row = fake.tables.user_tracks?.find((track) => track.track_id === trackId)
  if (row === undefined) throw new Error(`no ${trackId} enrollment`)
  row.budget_minutes = minutes
}

const todaysRow = (fake: FakeSupabase) =>
  fake.tables.day_plans?.find((plan) => plan.plan_date === TODAY)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})
afterEach(() => {
  vi.useRealTimers()
})

describe('rebuildTodayIfUntouched (decision 11)', () => {
  it("rebuilds an untouched baseline plan at the row's version after a budget change", async () => {
    const fake = await withTodaysPlan()
    const before = structuredClone(todaysRow(fake))
    setBudget(fake, 'dsa', 30)

    expect(await rebuildTodayIfUntouched(USER_ID, NOW)).toBe('rebuilt')
    const [, call, ...others] = storeCalls(fake)
    expect(others).toEqual([])
    expect(call).toMatchObject({
      client: 'admin',
      mode: 'rebuild',
      planDate: TODAY,
      expected: { [`day_plans:${TODAY}`]: 1 },
    })
    expect(todaysRow(fake)).toMatchObject({ id: before?.id, version: 2 })
    expect(todaysRow(fake)?.blocks).not.toEqual(before?.blocks)
  })

  it('writes nothing when the inputs are unchanged', async () => {
    const fake = await withTodaysPlan()
    expect(await rebuildTodayIfUntouched(USER_ID, NOW)).toBe('unchanged')
    expect(storeCalls(fake)).toHaveLength(1)
  })

  it('never rebuilds a resume plan', async () => {
    const plan = planRow({ date: TODAY, blocks: [planBlock(TODAY, 'dsa', 'new', ['dsa:p1'])] })
    const fake = resetEnv({
      schedule_versions: [scheduleRow()],
      user_tracks: [trackRow('dsa'), trackRow('english')],
      day_plans: [plan],
      events: [
        eventRow({
          type: 'plan.generated',
          plan_id: plan.id,
          payload: { mode: 'resume', planVersion: 1 },
        }),
      ],
    })
    planStore(fake)
    expect(await rebuildTodayIfUntouched(USER_ID, NOW)).toBe('resume_plan')
    expect(fake.rpcs()).toEqual([])
  })

  it('answers in_use for a plan in use (plan_in_use)', async () => {
    const fake = await withTodaysPlan()
    const row = todaysRow(fake)!
    const [block] = row.blocks as unknown as [ReturnType<typeof planBlock>]
    fake.tables.plan_block_state = [blockStateRow(row, block, 'done', TODAY)]
    setBudget(fake, 'dsa', 30)
    expect(await rebuildTodayIfUntouched(USER_ID, NOW)).toBe('in_use')
    expect(todaysRow(fake)?.version).toBe(1)
  })

  it('answers no_plan without a plan for today', async () => {
    const fake = resetEnv({
      schedule_versions: [scheduleRow()],
      user_tracks: [trackRow('dsa')],
    })
    expect(await rebuildTodayIfUntouched(USER_ID, NOW)).toBe('no_plan')
    expect(fake.rpcs()).toEqual([])
  })

  it('rebuilds an unreadable plan for today (M-4)', async () => {
    const fake = resetEnv({
      schedule_versions: [scheduleRow()],
      user_tracks: [trackRow('dsa')],
      day_plans: [planRow({ date: TODAY, blocks: [{ kind: 'mystery' }], version: 2 })],
    })
    planStore(fake)
    expect(await rebuildTodayIfUntouched(USER_ID, NOW)).toBe('rebuilt')
    expect(storeCalls(fake)[0]?.expected).toEqual({ [`day_plans:${TODAY}`]: 2 })
  })

  it('retries a version_conflict or day_changed once, then answers in_use', async () => {
    const fake = await withTodaysPlan()
    setBudget(fake, 'dsa', 30)
    planStore(fake, ['version_conflict', 'day_changed'])
    expect(await rebuildTodayIfUntouched(USER_ID, NOW)).toBe('in_use')
    expect(storeCalls(fake)).toHaveLength(3)

    planStore(fake, ['day_changed'])
    expect(await rebuildTodayIfUntouched(USER_ID, NOW)).toBe('rebuilt')
    expect(storeCalls(fake)).toHaveLength(5)
  })

  it('never throws an EventError: the stored plan stays (the change applies tomorrow)', async () => {
    const fake = await withTodaysPlan()
    setBudget(fake, 'dsa', 30)
    planStore(fake, ['quota_exceeded'])
    expect(await rebuildTodayIfUntouched(USER_ID, NOW)).toBe('in_use')
    expect(storeCalls(fake)).toHaveLength(2)
    expect(todaysRow(fake)?.version).toBe(1)
  })

  it('throws, reading nothing, when userId is not the signed-in user (decision 5)', async () => {
    const fake = resetEnv({ schedule_versions: [scheduleRow()] })
    await expect(rebuildTodayIfUntouched(OTHER_USER_ID, NOW)).rejects.toThrow()
    env.sessionUserId = null
    await expect(rebuildTodayIfUntouched(USER_ID, NOW)).rejects.toThrow()
    expect(fake.calls).toEqual([])
  })
})
