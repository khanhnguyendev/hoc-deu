import type { SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Database } from '@/lib/supabase/database.types'

const supabase = vi.hoisted(() => ({ createClient: vi.fn() }))
const env = vi.hoisted(() => ({ publicSupabaseEnv: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({ createClient: supabase.createClient }))
vi.mock('@/lib/env', () => ({ publicSupabaseEnv: env.publicSupabaseEnv }))

const { databaseIsHealthy } = await import('./health')

type Result = { data: unknown; error: { message: string } | null }

function fakeClient(result: Result | (() => Promise<Result>)) {
  const abortSignal = vi.fn<(signal: AbortSignal) => Promise<Result>>(async () =>
    typeof result === 'function' ? result() : result,
  )
  const rpc = vi.fn(() => ({ abortSignal }))
  return { client: { rpc } as unknown as SupabaseClient<Database>, rpc, abortSignal }
}

beforeEach(() => {
  supabase.createClient.mockReset()
  env.publicSupabaseEnv.mockReset()
  env.publicSupabaseEnv.mockReturnValue({
    supabaseUrl: 'http://127.0.0.1:54321',
    supabasePublishableKey: 'sb_publishable_test',
  })
})

describe('databaseIsHealthy (§2.3: /api/health, a cheap DB query)', () => {
  it('is true when health() answers true, with a time limit on the call', async () => {
    const { client, rpc, abortSignal } = fakeClient({ data: true, error: null })
    expect(await databaseIsHealthy(client)).toBe(true)
    expect(rpc).toHaveBeenCalledWith('health')
    expect(abortSignal.mock.calls[0]?.[0]).toBeInstanceOf(AbortSignal)
  })

  it.each([
    ['an error', { data: null, error: { message: 'connection refused' } }],
    ['a false answer', { data: false, error: null }],
    ['no answer', { data: null, error: null }],
  ])('is false for %s', async (_, result) => {
    expect(await databaseIsHealthy(fakeClient(result).client)).toBe(false)
  })

  it('is false when the call throws (a timeout aborts it)', async () => {
    const { client } = fakeClient(() =>
      Promise.reject(new DOMException('timed out', 'TimeoutError')),
    )
    expect(await databaseIsHealthy(client)).toBe(false)
  })

  it('by default uses the publishable key and no session', async () => {
    const { client, rpc } = fakeClient({ data: true, error: null })
    supabase.createClient.mockReturnValue(client)
    expect(await databaseIsHealthy()).toBe(true)
    expect(supabase.createClient).toHaveBeenCalledWith(
      'http://127.0.0.1:54321',
      'sb_publishable_test',
      { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
    )
    expect(rpc).toHaveBeenCalledWith('health')
  })

  it('is false when the public Supabase values are missing', async () => {
    env.publicSupabaseEnv.mockImplementation(() => {
      throw new Error('Invalid environment variables: NEXT_PUBLIC_SUPABASE_URL')
    })
    expect(await databaseIsHealthy()).toBe(false)
    expect(supabase.createClient).not.toHaveBeenCalled()
  })
})
