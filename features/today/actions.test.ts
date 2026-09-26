import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EventError } from '@/lib/events/apply'
import { vi as copy } from '@/lib/i18n/vi'
import type { ResumeOutcome } from '@/lib/plans/resume'
import { createFakeSupabase, type FakeSupabase } from '@/lib/testing/fake-supabase'

const USER_ID = '5b0c61a2-7f5e-4c3b-9a41-2f1d7c8e9a10'
const PLAN_ID = '9f8e7d6c-5b4a-4c3d-8e2f-1a0b9c8d7e6f'

const state = vi.hoisted(() => ({
  log: [] as unknown[][],
  /** The guard throws this (a redirect) when set. */
  denied: null as Error | null,
  fake: null as unknown as FakeSupabase,
  resume: (async () => 'created') as () => Promise<ResumeOutcome>,
}))

vi.mock('next/cache', () => ({
  revalidatePath: (path: string) => {
    state.log.push(['revalidatePath', path])
  },
}))
vi.mock('@/lib/auth/dal', () => ({
  requireOnboarded: async () => {
    state.log.push(['requireOnboarded'])
    if (state.denied !== null) throw state.denied
    return { id: USER_ID }
  },
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => state.fake.client('session'),
}))
vi.mock('@/lib/plans/resume', () => ({
  resumeToday: async (userId: string) => {
    state.log.push(['resumeToday', userId])
    return state.resume()
  },
}))

const { markPlanSeen, resumeTodayAction } = await import('./actions')

beforeEach(() => {
  state.log = []
  state.denied = null
  state.fake = createFakeSupabase()
  state.fake.onRpc('mark_plan_seen', () => {
    state.log.push(['mark_plan_seen'])
    return { data: true, error: null }
  })
  state.resume = async () => 'created'
})

describe('markPlanSeen (§5.2, ADR-0039)', () => {
  it('runs the guard first, then mark_plan_seen with the plan id', async () => {
    await markPlanSeen(PLAN_ID)
    expect(state.log).toEqual([['requireOnboarded'], ['mark_plan_seen']])
    expect(state.fake.rpcs()).toEqual([
      { kind: 'rpc', client: 'session', name: 'mark_plan_seen', args: { p_plan_id: PLAN_ID } },
    ])
  })

  it.each(['', 'not-a-uuid', `${PLAN_ID}x`, 42 as unknown as string])(
    'sends nothing for %j',
    async (planId) => {
      await markPlanSeen(planId)
      expect(state.log).toEqual([['requireOnboarded']])
      expect(state.fake.rpcs()).toEqual([])
    },
  )

  it('sends nothing when the guard redirects', async () => {
    state.denied = new Error('REDIRECT:/sign-in')
    await expect(markPlanSeen(PLAN_ID)).rejects.toThrow('REDIRECT:/sign-in')
    expect(state.fake.rpcs()).toEqual([])
  })

  it('logs a failed rpc (its code and message only) and returns', async () => {
    state.fake.onRpc('mark_plan_seen', () => ({
      data: null,
      error: { message: 'inactive', code: '42501' },
    }))
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      await expect(markPlanSeen(PLAN_ID)).resolves.toBeUndefined()
      expect(logged).toHaveBeenCalledWith('[today] mark_plan_seen failed:', '42501 inactive')
      expect(JSON.stringify(logged.mock.calls)).not.toContain(PLAN_ID)
    } finally {
      logged.mockRestore()
    }
  })
})

describe('resumeTodayAction ("Học tiếp hôm nay", §5.8)', () => {
  it.each([
    ['created', true, copy.today.resumeResult.created],
    ['exists', true, copy.today.resumeResult.exists],
    ['not_offered', false, copy.today.resumeResult.notOffered],
  ] as const)('answers %s with its message and re-renders /today', async (outcome, ok, message) => {
    state.resume = async () => outcome
    expect(await resumeTodayAction()).toEqual({ ok, message })
    expect(state.log).toEqual([
      ['requireOnboarded'],
      ['resumeToday', USER_ID],
      ['revalidatePath', '/today'],
    ])
  })

  it('answers an EventError with its Vietnamese message', async () => {
    state.resume = async () => {
      throw new EventError('quota_exceeded')
    }
    expect(await resumeTodayAction()).toEqual({ ok: false, message: copy.errors.quotaExceeded })
    expect(state.log).toContainEqual(['revalidatePath', '/today'])
  })

  it('lets any other error reach the error boundary', async () => {
    state.resume = async () => {
      throw new Error('boom')
    }
    await expect(resumeTodayAction()).rejects.toThrow('boom')
  })

  it('does nothing when the guard redirects', async () => {
    state.denied = new Error('REDIRECT:/onboarding')
    await expect(resumeTodayAction()).rejects.toThrow('REDIRECT:/onboarding')
    expect(state.log).toEqual([['requireOnboarded']])
  })
})
