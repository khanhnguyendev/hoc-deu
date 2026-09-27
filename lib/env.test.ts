import { afterEach, describe, expect, it, vi } from 'vitest'
import { EnvError, parseServerEnv, publicSupabaseEnv } from './env'

afterEach(() => {
  vi.unstubAllEnvs()
})

const SENTINEL = 'sentinel-value-should-never-leak-into-error-messages'

const validSource = {
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
  SUPABASE_SECRET_KEY: 'sb_secret_test',
  NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
}

function omit<T extends Record<string, string>, K extends keyof T>(source: T, key: K): Omit<T, K> {
  const copy = { ...source }
  delete copy[key]
  return copy
}

describe('parseServerEnv', () => {
  it('parses a complete valid source', () => {
    const env = parseServerEnv(validSource)
    expect(env).toMatchObject({
      supabaseUrl: 'http://127.0.0.1:54321',
      supabasePublishableKey: 'sb_publishable_test',
      supabaseSecretKey: 'sb_secret_test',
      siteUrl: 'http://localhost:3000',
      adminEmails: [],
      authTestLogin: false,
      vercelEnv: undefined,
      cronSecret: undefined,
    })
  })

  it('trims, lower-cases and drops empty ADMIN_EMAILS entries', () => {
    const env = parseServerEnv({ ...validSource, ADMIN_EMAILS: ' A@X.com, ,b@y.com ' })
    expect(env.adminEmails).toEqual(['a@x.com', 'b@y.com'])
  })

  it('defaults ADMIN_EMAILS to an empty list when unset', () => {
    const env = parseServerEnv(validSource)
    expect(env.adminEmails).toEqual([])
  })

  it('throws EnvError naming SUPABASE_SECRET_KEY when it is missing, without leaking other values', () => {
    const rest = omit(validSource, 'SUPABASE_SECRET_KEY')
    let error: unknown
    try {
      parseServerEnv({ ...rest, ADMIN_EMAILS: SENTINEL })
    } catch (caught) {
      error = caught
    }
    expect(error).toBeInstanceOf(EnvError)
    const message = (error as EnvError).message
    expect(message).toContain('SUPABASE_SECRET_KEY')
    expect(message).not.toContain(SENTINEL)
  })

  it('throws EnvError naming NEXT_PUBLIC_SUPABASE_URL when it is not a URL', () => {
    expect(() => parseServerEnv({ ...validSource, NEXT_PUBLIC_SUPABASE_URL: 'not a url' })).toThrow(
      EnvError,
    )
    try {
      parseServerEnv({ ...validSource, NEXT_PUBLIC_SUPABASE_URL: 'not a url' })
      expect.unreachable()
    } catch (error) {
      expect((error as EnvError).message).toContain('NEXT_PUBLIC_SUPABASE_URL')
    }
  })

  it('rejects AUTH_TEST_LOGIN=true combined with VERCEL_ENV=production', () => {
    expect(() =>
      parseServerEnv({
        ...validSource,
        AUTH_TEST_LOGIN: 'true',
        VERCEL_ENV: 'production',
        CRON_SECRET: 'a'.repeat(32),
      }),
    ).toThrow(new EnvError('AUTH_TEST_LOGIN must not be enabled in production'))
  })

  it('allows AUTH_TEST_LOGIN=true with VERCEL_ENV=preview', () => {
    const env = parseServerEnv({
      ...validSource,
      AUTH_TEST_LOGIN: 'true',
      VERCEL_ENV: 'preview',
    })
    expect(env.authTestLogin).toBe(true)
  })

  it('rejects an AUTH_TEST_LOGIN value that is not "true" or "false"', () => {
    expect(() => parseServerEnv({ ...validSource, AUTH_TEST_LOGIN: 'yes' })).toThrow(EnvError)
  })

  it('derives siteUrl from VERCEL_BRANCH_URL on preview even without NEXT_PUBLIC_SITE_URL', () => {
    const rest = omit(validSource, 'NEXT_PUBLIC_SITE_URL')
    const env = parseServerEnv({
      ...rest,
      VERCEL_ENV: 'preview',
      VERCEL_BRANCH_URL: 'hoc-deu-git-x-me.vercel.app',
    })
    expect(env.siteUrl).toBe('https://hoc-deu-git-x-me.vercel.app')
  })

  it('throws when VERCEL_ENV=production and NEXT_PUBLIC_SITE_URL is unset', () => {
    const rest = omit(validSource, 'NEXT_PUBLIC_SITE_URL')
    expect(() =>
      parseServerEnv({ ...rest, VERCEL_ENV: 'production', CRON_SECRET: 'a'.repeat(32) }),
    ).toThrow(new EnvError('Invalid environment variables: NEXT_PUBLIC_SITE_URL'))
  })

  it('rejects a CRON_SECRET shorter than 32 characters', () => {
    expect(() => parseServerEnv({ ...validSource, CRON_SECRET: 'too-short' })).toThrow(EnvError)
  })

  it('leaves cronSecret undefined when unset', () => {
    const env = parseServerEnv(validSource)
    expect(env.cronSecret).toBeUndefined()
  })

  it('accepts a CRON_SECRET of 32 or more characters', () => {
    const cronSecret = 'a'.repeat(32)
    const env = parseServerEnv({ ...validSource, CRON_SECRET: cronSecret })
    expect(env.cronSecret).toBe(cronSecret)
  })

  it("treats an empty CRON_SECRET (.env.example's placeholder) as unset outside production", () => {
    expect(parseServerEnv({ ...validSource, CRON_SECRET: '' }).cronSecret).toBeUndefined()
    expect(
      parseServerEnv({ ...validSource, CRON_SECRET: '', VERCEL_ENV: 'preview' }).cronSecret,
    ).toBeUndefined()
  })

  it.each([
    ['unset', {}],
    ['empty', { CRON_SECRET: '' }],
  ])(
    'requires CRON_SECRET when VERCEL_ENV=production (%s), naming only the variable',
    (_, extra) => {
      expect(() => parseServerEnv({ ...validSource, ...extra, VERCEL_ENV: 'production' })).toThrow(
        new EnvError('Invalid environment variables: CRON_SECRET'),
      )
    },
  )

  it('still rejects a short CRON_SECRET in production without printing it', () => {
    try {
      parseServerEnv({
        ...validSource,
        CRON_SECRET: SENTINEL.slice(0, 20),
        VERCEL_ENV: 'production',
      })
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(EnvError)
      expect((error as EnvError).message).toContain('CRON_SECRET')
      expect((error as EnvError).message).not.toContain(SENTINEL.slice(0, 20))
    }
  })

  it('accepts production with a CRON_SECRET of 32 or more characters', () => {
    const cronSecret = 'b'.repeat(64)
    const env = parseServerEnv({
      ...validSource,
      CRON_SECRET: cronSecret,
      VERCEL_ENV: 'production',
    })
    expect(env.cronSecret).toBe(cronSecret)
    expect(env.vercelEnv).toBe('production')
  })
})

describe('publicSupabaseEnv', () => {
  it('reads NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY from process.env', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test')
    expect(publicSupabaseEnv()).toEqual({
      supabaseUrl: 'http://127.0.0.1:54321',
      supabasePublishableKey: 'sb_publishable_test',
    })
  })

  it('throws EnvError naming the missing variable', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', undefined)
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test')
    let error: unknown
    try {
      publicSupabaseEnv()
    } catch (caught) {
      error = caught
    }
    expect(error).toBeInstanceOf(EnvError)
    expect((error as EnvError).message).toContain('NEXT_PUBLIC_SUPABASE_URL')
  })
})
