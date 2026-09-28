import { beforeEach, describe, expect, it, vi } from 'vitest'

const fake = vi.hoisted(() => ({
  /** `serverEnv().upstash`: undefined means "no Upstash configured" (memory mode). */
  upstash: undefined as { url: string; token: string } | undefined,
  /** Every `createAdminClient().rpc(...)` call, for the fail-open bump assertions. */
  rpcCalls: [] as unknown[][],
}))

vi.mock('@/lib/env', () => ({
  serverEnv: () => ({ upstash: fake.upstash }),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc: (name: string, args: unknown) => {
      fake.rpcCalls.push([name, args])
      return Promise.resolve({ data: null, error: null })
    },
  }),
}))
// No test needs a working Redis client (every Upstash-path test injects `deps.limiter`, bypassing
// real construction) — this lets one dedicated describe block exercise a construction failure
// (fix round 1, item 1: `new Redis({ url })` throws `UrlError` for a bad URL, outside try/catch).
vi.mock('@upstash/redis', () => ({
  Redis: class {
    constructor() {
      throw new Error('Redis construction failed')
    }
  },
}))

const { __resetMemoryWindows, checkLimit, clientIp, LIMITS, rateLimitMode } =
  await import('./rate-limit')
type LimitName = Parameters<typeof checkLimit>[0]

beforeEach(() => {
  fake.upstash = undefined
  fake.rpcCalls = []
  __resetMemoryWindows()
})

const LIMIT_NAMES = Object.keys(LIMITS) as LimitName[]

describe('checkLimit — in-memory (no Upstash configured)', () => {
  it.each(LIMIT_NAMES)(
    'allows up to and including the %s limit, refuses the next',
    async (name) => {
      const { tokens } = LIMITS[name]
      const now = () => 1_000_000
      const id = `under-at-over:${name}`
      for (let i = 0; i < tokens; i++) {
        const result = await checkLimit(name, id, { now })
        expect(result).toEqual({ ok: true, retryAfterSeconds: 0, source: 'memory' })
      }
      const over = await checkLimit(name, id, { now })
      expect(over.ok).toBe(false)
      expect(over.source).toBe('memory')
      expect(over.retryAfterSeconds).toBeGreaterThan(0)
    },
  )

  it('never calls the fail-open bump', async () => {
    await checkLimit('adminAction', 'no-bump', {})
    expect(fake.rpcCalls).toEqual([])
  })

  it('slides the window: a refused request is allowed again once the oldest entry ages out', async () => {
    const { tokens, window } = LIMITS.adminAction
    expect(window).toBe('1 m')
    const windowMs = 60_000
    let now = 0
    const id = 'sliding-window'
    for (let i = 0; i < tokens; i++) {
      expect((await checkLimit('adminAction', id, { now: () => now })).ok).toBe(true)
      now += 100
    }
    expect((await checkLimit('adminAction', id, { now: () => now })).ok).toBe(false)
    // Past the window from the *first* recorded request: that slot has freed up again.
    now = windowMs + 1
    expect((await checkLimit('adminAction', id, { now: () => now })).ok).toBe(true)
  })

  it('bounds the memory map to 10 000 identifiers, evicting the oldest first', async () => {
    const now = () => 5_000_000
    const { tokens } = LIMITS.adminAction
    const evicted = 'evict-me'
    for (let i = 0; i < tokens; i++) {
      expect((await checkLimit('adminAction', evicted, { now })).ok).toBe(true)
    }
    expect((await checkLimit('adminAction', evicted, { now })).ok).toBe(false)

    for (let i = 0; i < 10_000; i++) {
      await checkLimit('adminAction', `fresh-${i}`, { now })
    }

    // Evicted: a fresh window, so the identifier is allowed again despite having used its
    // whole budget before the eviction.
    expect((await checkLimit('adminAction', evicted, { now })).ok).toBe(true)
  })

  it(
    '__resetMemoryWindows clears every in-memory window (test-only; fix round 1, item 4 — so ' +
      "callers' tests don't depend on shared window state)",
    async () => {
      const now = () => 0
      const { tokens } = LIMITS.adminAction
      const id = 'reset-me'
      for (let i = 0; i < tokens; i++) {
        expect((await checkLimit('adminAction', id, { now })).ok).toBe(true)
      }
      expect((await checkLimit('adminAction', id, { now })).ok).toBe(false)

      __resetMemoryWindows()

      expect((await checkLimit('adminAction', id, { now })).ok).toBe(true)
    },
  )
})

describe('checkLimit — Upstash fails open', () => {
  const id = 'fail-open-user'

  it('falls back to memory and bumps the fail-open metric once when the limiter throws', async () => {
    const limiter = { limit: async () => Promise.reject(new Error('network down')) }
    const result = await checkLimit('botApi', id, { limiter, now: () => 0 })
    expect(result.source).toBe('fail-open')
    expect(result.ok).toBe(true)
    expect(fake.rpcCalls).toEqual([['ops_bump_metric', { p_key: 'ratelimit.fail_open' }]])
  })

  it("falls back to memory and bumps the fail-open metric once on reason: 'timeout'", async () => {
    const limiter = {
      limit: async () => ({ success: true, limit: 0, remaining: 0, reset: 0, reason: 'timeout' }),
    }
    const result = await checkLimit('botApi', 'fail-open-timeout', { limiter, now: () => 0 })
    expect(result.source).toBe('fail-open')
    expect(fake.rpcCalls).toEqual([['ops_bump_metric', { p_key: 'ratelimit.fail_open' }]])
  })

  it('the fail-open decision still enforces the in-memory window (not an unconditional allow)', async () => {
    const limiter = { limit: async () => Promise.reject(new Error('down')) }
    const now = () => 42
    const { tokens } = LIMITS.accountDeletion
    for (let i = 0; i < tokens; i++) {
      const result = await checkLimit('accountDeletion', id, { limiter, now })
      expect(result.ok).toBe(true)
    }
    const over = await checkLimit('accountDeletion', id, { limiter, now })
    expect(over.ok).toBe(false)
    expect(over.source).toBe('fail-open')
  })
})

describe('checkLimit — Upstash configured but the limiter fails to construct (fix round 1, item 1)', () => {
  it('falls back to memory and bumps the fail-open metric instead of throwing', async () => {
    fake.upstash = { url: 'https://example.upstash.io', token: 'token' }
    const result = await checkLimit('botApi', 'construction-fails', { now: () => 0 })
    expect(result.source).toBe('fail-open')
    expect(result.ok).toBe(true)
    expect(fake.rpcCalls).toEqual([['ops_bump_metric', { p_key: 'ratelimit.fail_open' }]])
  })

  it('still enforces the in-memory window on repeated construction failures', async () => {
    fake.upstash = { url: 'https://example.upstash.io', token: 'token' }
    const now = () => 99
    const id = 'construction-fails-window'
    const { tokens } = LIMITS.accountDeletion
    for (let i = 0; i < tokens; i++) {
      expect((await checkLimit('accountDeletion', id, { now })).ok).toBe(true)
    }
    const over = await checkLimit('accountDeletion', id, { now })
    expect(over.ok).toBe(false)
    expect(over.source).toBe('fail-open')
  })
})

describe('checkLimit — Upstash succeeds', () => {
  it('answers ok/refused straight from the limiter, converting reset (ms) to retryAfterSeconds', async () => {
    const limiter = { limit: async () => ({ success: false, reset: 5_000 }) }
    const result = await checkLimit('botApi', 'upstash-user', { limiter, now: () => 2_000 })
    expect(result).toEqual({ ok: false, retryAfterSeconds: 3, source: 'upstash' })
    expect(fake.rpcCalls).toEqual([])
  })

  it('never bumps the fail-open metric on a normal allow', async () => {
    const limiter = { limit: async () => ({ success: true, reset: 0 }) }
    await checkLimit('botApi', 'upstash-user-2', { limiter, now: () => 0 })
    expect(fake.rpcCalls).toEqual([])
  })

  it(
    'answers retryAfterSeconds: 0 for an allowed request, even while the sliding window’s own ' +
      'reset is still in the future (fix round 1, item 4: retryAfterSeconds only matters when refused)',
    async () => {
      const limiter = { limit: async () => ({ success: true, reset: 9_000 }) }
      const result = await checkLimit('botApi', 'upstash-user-3', { limiter, now: () => 1_000 })
      expect(result).toEqual({ ok: true, retryAfterSeconds: 0, source: 'upstash' })
    },
  )
})

describe('clientIp', () => {
  it('reads the first x-forwarded-for entry', () => {
    expect(clientIp(new Headers({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' }))).toBe('1.2.3.4')
  })

  it('falls back to x-real-ip without x-forwarded-for', () => {
    expect(clientIp(new Headers({ 'x-real-ip': '9.9.9.9' }))).toBe('9.9.9.9')
  })

  it("is 'unknown' with neither header", () => {
    expect(clientIp(new Headers())).toBe('unknown')
  })

  it("is 'unknown' when x-forwarded-for is present but empty", () => {
    expect(clientIp(new Headers({ 'x-forwarded-for': '' }))).toBe('unknown')
  })
})

describe('rateLimitMode', () => {
  it("is 'memory' without UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN", () => {
    fake.upstash = undefined
    expect(rateLimitMode()).toBe('memory')
  })

  it("is 'upstash' once both are configured", () => {
    fake.upstash = { url: 'https://example.upstash.io', token: 'token' }
    expect(rateLimitMode()).toBe('upstash')
  })
})
