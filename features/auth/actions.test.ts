import { beforeEach, describe, expect, it, vi } from 'vitest'

const fake = vi.hoisted(() => ({
  env: { authTestLogin: true, siteUrl: 'https://hocdeu.example' },
  user: null as { id: string } | null,
  oauth: { data: { url: 'https://auth.example/authorize?x=1' }, error: null } as {
    data: { url: string | null }
    error: { message: string } | null
  },
  password: {
    data: { user: { id: 'u1', email: 'a@example.test', email_confirmed_at: 'x' } },
    error: null,
  } as {
    data: { user: { id: string; email: string; email_confirmed_at: string } | null }
    error: { code?: string; message: string } | null
  },
  calls: [] as unknown[][],
  signOut: { error: null } as { error: Error | null },
  localSignOut: { error: null } as { error: Error | null },
}))

vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`)
  },
}))
vi.mock('@/lib/env', () => ({ serverEnv: () => fake.env }))
vi.mock('@/lib/auth/dal', () => ({
  requireUser: async () => {
    if (!fake.user) throw new Error('REDIRECT:/sign-in')
    return fake.user
  },
}))
vi.mock('@/lib/auth/sign-in', () => ({
  completeSignIn: async (_supabase: unknown, user: { id: string }, next: string) => {
    fake.calls.push(['completeSignIn', user.id, next])
    return next === '/today' ? '/today' : '/onboarding'
  },
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      signInWithOAuth: async (args: unknown) => {
        fake.calls.push(['signInWithOAuth', args])
        return fake.oauth
      },
      signInWithPassword: async (args: unknown) => {
        fake.calls.push(['signInWithPassword', args])
        return fake.password
      },
      signOut: async (options?: { scope: 'local' }) => {
        fake.calls.push(['signOut', options])
        return options?.scope === 'local' ? fake.localSignOut : fake.signOut
      },
    },
  }),
}))

const { signInWithProvider, signInWithTestLogin, signOut } = await import('./actions')

const form = (fields: Record<string, string>) => {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.set(key, value)
  return data
}

beforeEach(() => {
  fake.env = { authTestLogin: true, siteUrl: 'https://hocdeu.example' }
  fake.user = null
  fake.oauth = { data: { url: 'https://auth.example/authorize?x=1' }, error: null }
  fake.password = {
    data: { user: { id: 'u1', email: 'a@example.test', email_confirmed_at: 'x' } },
    error: null,
  }
  fake.calls = []
  fake.signOut = { error: null }
  fake.localSignOut = { error: null }
})

describe('signInWithProvider', () => {
  it('starts OAuth with the callback URL carrying the safe next, then goes to the provider', async () => {
    await expect(signInWithProvider(form({ provider: 'github', next: '/today' }))).rejects.toThrow(
      'REDIRECT:https://auth.example/authorize?x=1',
    )
    expect(fake.calls).toEqual([
      [
        'signInWithOAuth',
        {
          provider: 'github',
          options: { redirectTo: 'https://hocdeu.example/auth/callback?next=%2Ftoday' },
        },
      ],
    ])
  })

  it('drops an unsafe next', async () => {
    await expect(
      signInWithProvider(form({ provider: 'google', next: '//evil.test' })),
    ).rejects.toThrow('REDIRECT:')
    expect(fake.calls[0]?.[1]).toEqual({
      provider: 'google',
      options: { redirectTo: 'https://hocdeu.example/auth/callback' },
    })
  })

  it.each(['', 'facebook', 'email'])('refuses provider %j', async (provider) => {
    await expect(signInWithProvider(form({ provider, next: '/today' }))).rejects.toThrow(
      'REDIRECT:/sign-in?error=oauth&next=%2Ftoday',
    )
    expect(fake.calls).toEqual([])
  })

  it('returns to sign-in with the error when OAuth cannot start', async () => {
    fake.oauth = { data: { url: null }, error: { message: 'boom' } }
    await expect(signInWithProvider(form({ provider: 'google' }))).rejects.toThrow(
      'REDIRECT:/sign-in?error=oauth',
    )
  })
})

describe('signInWithTestLogin (§2.3)', () => {
  const credentials = { email: ' learner@example.test ', password: 'test-password-123' }

  it('refuses unless AUTH_TEST_LOGIN is on, without calling Supabase', async () => {
    fake.env = { ...fake.env, authTestLogin: false }
    await expect(signInWithTestLogin({ error: null }, form(credentials))).resolves.toEqual({
      error: 'Đăng nhập thử nghiệm không được bật.',
    })
    expect(fake.calls).toEqual([])
  })

  it('signs in, completes the sign-in with next and redirects there', async () => {
    await expect(
      signInWithTestLogin({ error: null }, form({ ...credentials, next: '/today' })),
    ).rejects.toThrow('REDIRECT:/today')
    expect(fake.calls).toEqual([
      ['signInWithPassword', { email: 'learner@example.test', password: 'test-password-123' }],
      ['completeSignIn', 'u1', '/today'],
    ])
  })

  it('shows "wrong e-mail or password" for invalid credentials', async () => {
    fake.password = {
      data: { user: null },
      error: { code: 'invalid_credentials', message: 'Invalid login credentials' },
    }
    await expect(signInWithTestLogin({ error: null }, form(credentials))).resolves.toEqual({
      error: 'Email hoặc mật khẩu không đúng.',
    })
  })

  it('shows the general failure for any other error', async () => {
    fake.password = {
      data: { user: null },
      error: { code: 'over_request_rate_limit', message: '' },
    }
    await expect(signInWithTestLogin({ error: null }, form(credentials))).resolves.toEqual({
      error: 'Đăng nhập không thành công. Bạn thử lại nhé.',
    })
  })

  it('does not call Supabase with an empty e-mail or password', async () => {
    await expect(
      signInWithTestLogin({ error: null }, form({ email: ' ', password: 'x' })),
    ).resolves.toEqual({ error: 'Email hoặc mật khẩu không đúng.' })
    expect(fake.calls).toEqual([])
  })
})

describe('signOut', () => {
  it('requires a signed-in user', async () => {
    await expect(signOut()).rejects.toThrow('REDIRECT:/sign-in')
    expect(fake.calls).toEqual([])
  })

  it('ends the (global) session and returns to sign-in', async () => {
    fake.user = { id: 'u1' }
    await expect(signOut()).rejects.toThrow('REDIRECT:/sign-in')
    expect(fake.calls).toEqual([['signOut', undefined]])
  })

  it('falls back to a local sign-out when the global one fails, then still redirects (M2 minor)', async () => {
    fake.user = { id: 'u1' }
    fake.signOut = { error: new Error('network down') }
    await expect(signOut()).rejects.toThrow('REDIRECT:/sign-in')
    expect(fake.calls).toEqual([
      ['signOut', undefined],
      ['signOut', { scope: 'local' }],
    ])
  })

  it('throws (no redirect) when the local fallback also fails (M2 minor)', async () => {
    fake.user = { id: 'u1' }
    fake.signOut = { error: new Error('network down') }
    fake.localSignOut = { error: new Error('cookies unavailable') }
    await expect(signOut()).rejects.toThrow('cookies unavailable')
    expect(fake.calls).toEqual([
      ['signOut', undefined],
      ['signOut', { scope: 'local' }],
    ])
  })
})
