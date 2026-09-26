import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DailyActivity } from '@/lib/domain/state'
import type { TodayData } from '@/lib/plans/today'
import { PLAN_ID, storedPlan, todayData, TRACK_MANIFESTS } from './__tests__/fixtures'

const USER_ID = '5b0c61a2-7f5e-4c3b-9a41-2f1d7c8e9a10'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

const state = vi.hoisted(() => ({
  log: [] as unknown[][],
  denied: null as Error | null,
  data: null as unknown,
  activity: {} as Record<string, unknown>,
}))

vi.mock('@/lib/auth/dal', () => ({
  requireOnboarded: async () => {
    state.log.push(['requireOnboarded'])
    if (state.denied !== null) throw state.denied
    return { id: USER_ID }
  },
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => 'session-client',
}))
vi.mock('@/lib/plans/today', () => ({
  ensureToday: async (userId: string) => {
    state.log.push(['ensureToday', userId])
    return state.data
  },
}))
vi.mock('@/lib/plans/reads', () => ({
  readDailyActivity: async (client: unknown, userId: string, from: string) => {
    state.log.push(['readDailyActivity', client, userId, from])
    return state.activity
  },
}))
vi.mock('@/lib/content/catalog', () => ({
  getTrack: (id: string) => TRACK_MANIFESTS[id] ?? null,
}))

const { getToday } = await import('./queries')

const completed = (localDay: string): DailyActivity => ({
  localDay,
  minutesByTrack: { dsa: 30 },
  itemsDone: 2,
  completed: true,
})

beforeEach(() => {
  state.log = []
  state.denied = null
  state.data = todayData({ kind: 'plan', plan: storedPlan(), blocks: {} })
  state.activity = {}
})

describe('getToday (task 5.1b)', () => {
  it('runs the guard first, then ensureToday for that user, then 400 days of daily_activity', async () => {
    await getToday()
    expect(state.log).toEqual([
      ['requireOnboarded'],
      ['ensureToday', USER_ID],
      // today 2026-09-28 − 400 days.
      ['readDailyActivity', 'session-client', USER_ID, '2025-08-24'],
    ])
  })

  it('builds the page from the data and the activity, with a fresh request id per call', async () => {
    state.activity = { '2026-09-27': completed('2026-09-27') }
    const first = await getToday()
    expect(first.data).toBe(state.data as TodayData)
    expect(first.streak).toBe(1)
    expect(first.markSeenPlanId).toBe(PLAN_ID)
    expect(first.requestId).toMatch(UUID)
    const second = await getToday()
    expect(second.requestId).toMatch(UUID)
    expect(second.requestId).not.toBe(first.requestId)
  })

  it('reads nothing when the guard redirects', async () => {
    state.denied = new Error('REDIRECT:/sign-in')
    await expect(getToday()).rejects.toThrow('REDIRECT:/sign-in')
    expect(state.log).toEqual([['requireOnboarded']])
  })
})
