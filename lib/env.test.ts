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
      upstash: undefined,
      botApiEnabled: false,
      botRefSecret: undefined,
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

describe('parseServerEnv — UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN (§2.3, decision 22)', () => {
  it('leaves upstash undefined when both are unset', () => {
    expect(parseServerEnv(validSource).upstash).toBeUndefined()
  })

  it('leaves upstash undefined when both are empty strings (.env.example placeholders)', () => {
    const env = parseServerEnv({
      ...validSource,
      UPSTASH_REDIS_REST_URL: '',
      UPSTASH_REDIS_REST_TOKEN: '',
    })
    expect(env.upstash).toBeUndefined()
  })

  it('reads both when both are set', () => {
    const env = parseServerEnv({
      ...validSource,
      UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'sentinel-token',
    })
    expect(env.upstash).toEqual({ url: 'https://example.upstash.io', token: 'sentinel-token' })
  })

  it.each([
    ['UPSTASH_REDIS_REST_URL', { UPSTASH_REDIS_REST_URL: 'https://example.upstash.io' }],
    ['UPSTASH_REDIS_REST_TOKEN', { UPSTASH_REDIS_REST_TOKEN: SENTINEL }],
  ])('throws EnvError naming both when only %s is set', (_, extra) => {
    let error: unknown
    try {
      parseServerEnv({ ...validSource, ...extra })
      expect.unreachable()
    } catch (caught) {
      error = caught
    }
    expect(error).toBeInstanceOf(EnvError)
    const message = (error as EnvError).message
    expect(message).toContain('UPSTASH_REDIS_REST_URL')
    expect(message).toContain('UPSTASH_REDIS_REST_TOKEN')
    expect(message).not.toContain(SENTINEL)
  })

  it('rejects a non-URL UPSTASH_REDIS_REST_URL', () => {
    expect(() =>
      parseServerEnv({
        ...validSource,
        UPSTASH_REDIS_REST_URL: 'not a url',
        UPSTASH_REDIS_REST_TOKEN: 'token',
      }),
    ).toThrow(EnvError)
  })

  it.each([
    'http://example.upstash.io',
    'redis://example.upstash.io',
    'rediss://example.upstash.io',
  ])(
    'rejects a non-https UPSTASH_REDIS_REST_URL (%s): new Redis({ url }) would otherwise throw ' +
      'uncaught outside parseServerEnv (fix round 1, item 1)',
    (url) => {
      let error: unknown
      try {
        parseServerEnv({
          ...validSource,
          UPSTASH_REDIS_REST_URL: url,
          UPSTASH_REDIS_REST_TOKEN: 'x',
        })
        expect.unreachable()
      } catch (caught) {
        error = caught
      }
      expect(error).toBeInstanceOf(EnvError)
      const message = (error as EnvError).message
      expect(message).toContain('UPSTASH_REDIS_REST_URL')
      expect(message).not.toContain('UPSTASH_REDIS_REST_TOKEN')
    },
  )
})

describe('parseServerEnv — BOT_API_ENABLED / BOT_REF_SECRET (§2.5, §6.2, decisions 5 and 7)', () => {
  const REF_SECRET = 'r'.repeat(32)

  it('leaves the bot API off when BOT_API_ENABLED is unset (nothing turns on by merging)', () => {
    const env = parseServerEnv(validSource)
    expect(env.botApiEnabled).toBe(false)
    expect(env.botRefSecret).toBeUndefined()
  })

  it.each(['', 'false'])('reads BOT_API_ENABLED=%j as off', (value) => {
    expect(parseServerEnv({ ...validSource, BOT_API_ENABLED: value }).botApiEnabled).toBe(false)
  })

  it('turns the bot API on only for exactly "true", with a BOT_REF_SECRET of 32+ characters', () => {
    const env = parseServerEnv({
      ...validSource,
      BOT_API_ENABLED: 'true',
      BOT_REF_SECRET: REF_SECRET,
    })
    expect(env.botApiEnabled).toBe(true)
    expect(env.botRefSecret).toBe(REF_SECRET)
  })

  it.each(['TRUE', '1', 'yes', 'on'])('rejects BOT_API_ENABLED=%j', (value) => {
    expect(() =>
      parseServerEnv({ ...validSource, BOT_API_ENABLED: value, BOT_REF_SECRET: REF_SECRET }),
    ).toThrow(/BOT_API_ENABLED/)
  })

  it.each([
    ['unset', {}],
    ['empty', { BOT_REF_SECRET: '' }],
  ])('rejects BOT_API_ENABLED=true with BOT_REF_SECRET %s', (_, extra) => {
    expect(() => parseServerEnv({ ...validSource, BOT_API_ENABLED: 'true', ...extra })).toThrow(
      EnvError,
    )
    expect(() => parseServerEnv({ ...validSource, BOT_API_ENABLED: 'true', ...extra })).toThrow(
      /BOT_REF_SECRET/,
    )
  })

  it('rejects a BOT_REF_SECRET under 32 characters without printing it', () => {
    const short = SENTINEL.slice(0, 31)
    let error: unknown
    try {
      parseServerEnv({ ...validSource, BOT_API_ENABLED: 'true', BOT_REF_SECRET: short })
      expect.unreachable()
    } catch (caught) {
      error = caught
    }
    expect(error).toBeInstanceOf(EnvError)
    expect((error as EnvError).message).toContain('BOT_REF_SECRET')
    expect((error as EnvError).message).not.toContain(short)
  })

  it('keeps a BOT_REF_SECRET while the API is off (ready for the switch)', () => {
    const env = parseServerEnv({ ...validSource, BOT_REF_SECRET: REF_SECRET })
    expect(env.botApiEnabled).toBe(false)
    expect(env.botRefSecret).toBe(REF_SECRET)
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
