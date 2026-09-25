import type { SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Database } from '@/lib/supabase/database.types'

const calls = vi.hoisted(() => [] as string[])
const bootstrapAdminIfListed = vi.hoisted(() =>
  vi.fn<(user: unknown) => Promise<boolean>>(async () => {
    calls.push('bootstrap')
    return false
  }),
)
vi.mock('./bootstrap', () => ({ bootstrapAdminIfListed }))

const { completeSignIn } = await import('./sign-in')

type Profile = { status: string; onboarded_at: string | null } | null

function fakeSupabase(profile: Profile, error: { message: string } | null = null) {
  const filters: unknown[] = []
  const client = {
    from: (table: string) => {
      if (table !== 'profiles') throw new Error(`unexpected table ${table}`)
      return {
        select: () => ({
          eq: (column: string, value: unknown) => {
            filters.push([column, value])
            return {
              maybeSingle: async () => {
                calls.push('profile')
                return { data: profile, error }
              },
            }
          },
        }),
      }
    },
  }
  return { supabase: client as unknown as SupabaseClient<Database>, filters }
}

const USER = {
  id: '22222222-2222-4222-8222-222222222222',
  email: 'learner@example.test',
  email_confirmed_at: '2026-09-24T01:00:00Z',
}
const ACTIVE_ONBOARDED: Profile = { status: 'active', onboarded_at: '2026-09-24T02:00:00Z' }

beforeEach(() => {
  calls.length = 0
  bootstrapAdminIfListed.mockClear()
})

describe('completeSignIn (§2.2, §2.5)', () => {
  it('bootstraps a listed admin with the provider-verified e-mail before reading the profile', async () => {
    const { supabase, filters } = fakeSupabase(ACTIVE_ONBOARDED)
    await expect(completeSignIn(supabase, USER, null)).resolves.toBe('/today')
    expect(bootstrapAdminIfListed).toHaveBeenCalledWith({
      id: USER.id,
      email: USER.email,
      emailConfirmedAt: USER.email_confirmed_at,
    })
    expect(calls).toEqual(['bootstrap', 'profile'])
    expect(filters).toEqual([['id', USER.id]])
  })

  it('goes to a safe next path', async () => {
    const { supabase } = fakeSupabase(ACTIVE_ONBOARDED)
    await expect(completeSignIn(supabase, USER, '/settings?tab=tracks')).resolves.toBe(
      '/settings?tab=tracks',
    )
    expect(bootstrapAdminIfListed).toHaveBeenCalledTimes(1)
  })

  it.each(['//evil.test', 'https://evil.test/', '/sign-in', '/auth/callback', ''])(
    'ignores an unsafe next (%s) and goes home',
    async (next) => {
      const { supabase } = fakeSupabase(ACTIVE_ONBOARDED)
      await expect(completeSignIn(supabase, USER, next)).resolves.toBe('/today')
    },
  )

  it.each([
    [{ status: 'pending', onboarded_at: null }, '/pending'],
    [{ status: 'rejected', onboarded_at: null }, '/pending'],
    [{ status: 'suspended', onboarded_at: '2026-09-24T02:00:00Z' }, '/pending'],
    [{ status: 'active', onboarded_at: null }, '/onboarding'],
    [ACTIVE_ONBOARDED, '/today'],
    [{ status: 'unknown', onboarded_at: '2026-09-24T02:00:00Z' }, '/pending'],
    [null, '/pending'],
  ] as const)('goes home from the fresh profile %j → %s', async (profile, home) => {
    const { supabase } = fakeSupabase(profile)
    await expect(completeSignIn(supabase, USER, undefined)).resolves.toBe(home)
  })

  it('throws when the profile cannot be read', async () => {
    const { supabase } = fakeSupabase(null, { message: 'boom' })
    await expect(completeSignIn(supabase, USER, null)).rejects.toThrow(/profile/)
  })
})
