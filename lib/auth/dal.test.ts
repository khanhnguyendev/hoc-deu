import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type ProfileRow = {
  role: string
  status: string
  display_name: string | null
  avatar_url: string | null
  code_language: string | null
  onboarded_at: string | null
  ai_personalization: boolean
}

const fake = vi.hoisted(() => ({
  claims: null as { sub: string; email?: string } | null,
  profile: null as ProfileRow | null,
  profileError: null as { message: string } | null,
  profileReads: 0,
  profileFilter: [] as unknown[],
  requestCache: new Map<unknown, unknown>(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getClaims: async () =>
        fake.claims ? { data: { claims: fake.claims }, error: null } : { data: null, error: null },
    },
    from: (table: string) => {
      if (table !== 'profiles') throw new Error(`unexpected table ${table}`)
      return {
        select: () => ({
          eq: (column: string, value: unknown) => {
            fake.profileFilter = [column, value]
            return {
              maybeSingle: async () => {
                fake.profileReads += 1
                return { data: fake.profile, error: fake.profileError }
              },
            }
          },
        }),
      }
    },
  }),
}))

vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`)
  },
  notFound: () => {
    throw new Error('NOT_FOUND')
  },
}))

// React cache() stand-in: memoises per "request"; beforeEach starts a new request.
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  cache: <T extends () => unknown>(fn: T) =>
    (() => {
      if (!fake.requestCache.has(fn)) fake.requestCache.set(fn, fn())
      return fake.requestCache.get(fn)
    }) as T,
}))

const dal = await import('./dal')

function profile(overrides: Partial<ProfileRow> = {}): ProfileRow {
  return {
    role: 'learner',
    status: 'active',
    display_name: 'Lan',
    avatar_url: null,
    code_language: 'python',
    onboarded_at: '2026-09-24T00:00:00Z',
    ai_personalization: false,
    ...overrides,
  }
}

beforeEach(() => {
  fake.claims = { sub: 'user-1', email: 'lan@example.test' }
  fake.profile = profile()
  fake.profileError = null
  fake.profileReads = 0
  fake.profileFilter = []
  fake.requestCache.clear()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('getSessionUser', () => {
  it('returns null without claims', async () => {
    fake.claims = null
    await expect(dal.getSessionUser()).resolves.toBeNull()
    expect(fake.profileReads).toBe(0)
  })

  it('maps the caller’s own profile row', async () => {
    await expect(dal.getSessionUser()).resolves.toEqual({
      id: 'user-1',
      email: 'lan@example.test',
      role: 'learner',
      status: 'active',
      displayName: 'Lan',
      avatarUrl: null,
      codeLanguage: 'python',
      onboardedAt: '2026-09-24T00:00:00Z',
      aiPersonalization: false,
      isAdmin: false,
    })
    expect(fake.profileFilter).toEqual(['id', 'user-1'])
  })

  it('reads a missing profile row as a pending learner', async () => {
    fake.profile = null
    await expect(dal.getSessionUser()).resolves.toMatchObject({
      id: 'user-1',
      role: 'learner',
      status: 'pending',
      onboardedAt: null,
      isAdmin: false,
    })
  })

  it('throws when the profile cannot be read (never guesses a status)', async () => {
    fake.profile = null
    fake.profileError = { message: 'connection refused' }
    await expect(dal.getSessionUser()).rejects.toThrow()
  })
})

describe('guards', () => {
  it('requireUser redirects a signed-out request to /sign-in', async () => {
    fake.claims = null
    await expect(dal.requireUser()).rejects.toThrow('REDIRECT:/sign-in')
  })

  it('requireActive redirects a pending user to /pending', async () => {
    fake.profile = profile({ status: 'pending', onboarded_at: null })
    await expect(dal.requireUser()).resolves.toMatchObject({ status: 'pending' })
    await expect(dal.requireActive()).rejects.toThrow('REDIRECT:/pending')
  })

  it('requireActive redirects rejected and suspended users to /pending', async () => {
    fake.profile = profile({ status: 'rejected' })
    await expect(dal.requireActive()).rejects.toThrow('REDIRECT:/pending')
    fake.requestCache.clear()
    fake.profile = profile({ status: 'suspended' })
    await expect(dal.requireActive()).rejects.toThrow('REDIRECT:/pending')
  })

  it('requireOnboarded redirects an active user without onboarding to /onboarding', async () => {
    fake.profile = profile({ onboarded_at: null })
    await expect(dal.requireActive()).resolves.toMatchObject({ onboardedAt: null })
    await expect(dal.requireOnboarded()).rejects.toThrow('REDIRECT:/onboarding')
  })

  it('requireOnboarded passes an onboarded active user', async () => {
    await expect(dal.requireOnboarded()).resolves.toMatchObject({ id: 'user-1' })
  })

  it('requireAdmin answers notFound for an active learner', async () => {
    await expect(dal.requireAdmin()).rejects.toThrow('NOT_FOUND')
  })

  it('requireAdmin passes an active admin, and isAdmin is true', async () => {
    fake.profile = profile({ role: 'admin' })
    await expect(dal.requireAdmin()).resolves.toMatchObject({ role: 'admin', isAdmin: true })
  })

  it('requireAdmin redirects a suspended admin to /pending', async () => {
    fake.profile = profile({ role: 'admin', status: 'suspended' })
    await expect(dal.getSessionUser()).resolves.toMatchObject({ isAdmin: false })
    await expect(dal.requireAdmin()).rejects.toThrow('REDIRECT:/pending')
  })

  it('reads the profile once per request across guards', async () => {
    await dal.requireUser()
    await dal.requireActive()
    await dal.requireOnboarded()
    expect(fake.profileReads).toBe(1)
  })

  it('requireDevAccess passes anyone outside production', async () => {
    fake.claims = null
    vi.stubEnv('VERCEL_ENV', 'preview')
    await expect(dal.requireDevAccess()).resolves.toBeUndefined()
    vi.stubEnv('VERCEL_ENV', '')
    await expect(dal.requireDevAccess()).resolves.toBeUndefined()
  })

  it('requireDevAccess requires an admin in production', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    await expect(dal.requireDevAccess()).rejects.toThrow('NOT_FOUND')
    fake.requestCache.clear()
    fake.claims = null
    await expect(dal.requireDevAccess()).rejects.toThrow('REDIRECT:/sign-in')
    fake.requestCache.clear()
    fake.claims = { sub: 'admin-1' }
    fake.profile = profile({ role: 'admin' })
    await expect(dal.requireDevAccess()).resolves.toBeUndefined()
  })
})
