import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetMemoryWindows } from '@/lib/rate-limit'

const fake = vi.hoisted(() => ({
  apiEnabled: true,
  settings: { enabled: true } as { enabled: boolean },
  token: {
    hash: null as string | null,
    prevHash: null as string | null,
    prevValidUntil: null as Date | null,
  },
  readError: false,
  reads: 0,
}))
const crypto = vi.hoisted(() => ({ timingSafeEqual: vi.fn() }))

vi.mock('@/lib/env', () => ({
  serverEnv: () => ({ botApiEnabled: fake.apiEnabled, upstash: undefined }),
}))
vi.mock('@/lib/bot/settings', () => ({
  readBotSettings: async () => {
    fake.reads += 1
    if (fake.readError) throw new Error('Could not read the bot settings')
    return {
      settings: {
        enabled: fake.settings.enabled,
        dryRun: true,
        contentProposals: false,
        perRunUserCap: 10,
        limits: {},
      },
      token: fake.token,
    }
  },
}))
vi.mock('node:crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:crypto')>()
  crypto.timingSafeEqual.mockImplementation(actual.timingSafeEqual)
  return { ...actual, default: actual, timingSafeEqual: crypto.timingSafeEqual }
})

const { requireBotToken } = await import('./bot')

const sha256 = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex')
const CURRENT = `hdb_${'A'.repeat(43)}`
const PREVIOUS = `hdb_${'B'.repeat(43)}`
const HOUR_MS = 3_600_000

const request = (authorization?: string) =>
  new Request('https://hocdeu.test/api/bot/v1/runs', {
    method: 'POST',
    headers: authorization === undefined ? {} : { authorization },
  })

async function expectDenied(
  denied: Response | null,
  status: number,
  error: string,
): Promise<Response> {
  expect(denied).not.toBeNull()
  const response = denied!
  expect(response.status).toBe(status)
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(response.headers.get('content-type')).toMatch(/^application\/json/)
  const text = await response.clone().text()
  expect(JSON.parse(text)).toEqual({ error })
  // Never echoes a token back.
  expect(text).not.toContain(CURRENT)
  expect(text).not.toContain(PREVIOUS)
  return response
}

beforeEach(() => {
  fake.apiEnabled = true
  fake.settings = { enabled: true }
  fake.token = { hash: sha256(CURRENT), prevHash: null, prevValidUntil: null }
  fake.readError = false
  fake.reads = 0
  crypto.timingSafeEqual.mockClear()
  __resetMemoryWindows()
})

describe('requireBotToken — the kill switch has two locks (§6.2, decision 7)', () => {
  it('answers 503 disabled while BOT_API_ENABLED is off, before reading the settings', async () => {
    fake.apiEnabled = false
    await expectDenied(await requireBotToken(request(`Bearer ${CURRENT}`)), 503, 'disabled')
    expect(fake.reads).toBe(0)
  })

  it('answers 503 disabled while bot_settings.enabled is off, even for the right token', async () => {
    fake.settings = { enabled: false }
    await expectDenied(await requireBotToken(request(`Bearer ${CURRENT}`)), 503, 'disabled')
    expect(fake.reads).toBe(1)
  })

  it('answers 503 disabled before 401: the switch is checked before the token', async () => {
    fake.settings = { enabled: false }
    await expectDenied(await requireBotToken(request()), 503, 'disabled')
  })

  it('answers 500 internal when the settings cannot be read (JSON, never a thrown page)', async () => {
    fake.readError = true
    await expectDenied(await requireBotToken(request(`Bearer ${CURRENT}`)), 500, 'internal')
  })
})

describe('requireBotToken — the token (§6.3, ADR-0026)', () => {
  it('lets the current token through (null: go on)', async () => {
    expect(await requireBotToken(request(`Bearer ${CURRENT}`))).toBeNull()
  })

  it.each([
    ['no header', undefined],
    ['an empty header', ''],
    ['Basic', `Basic ${CURRENT}`],
    ['a lower-case scheme', `bearer ${CURRENT}`],
    ['the bare token', CURRENT],
    ['"Bearer " alone', 'Bearer '],
    ['a wrong token of the same length', `Bearer hdb_${'C'.repeat(43)}`],
    ['a token of the wrong length', `Bearer ${CURRENT}A`],
    ['a shorter token', `Bearer ${CURRENT.slice(0, -1)}`],
    ['the stored hash', `Bearer ${sha256(CURRENT)}`],
  ])('answers 401 unauthorized for %s', async (_, authorization) => {
    const denied = await expectDenied(
      await requireBotToken(request(authorization)),
      401,
      'unauthorized',
    )
    expect(denied.headers.get('www-authenticate')).toBe('Bearer')
  })

  it('answers 401 while no token was ever created', async () => {
    fake.token = { hash: null, prevHash: null, prevValidUntil: null }
    await expectDenied(await requireBotToken(request(`Bearer ${CURRENT}`)), 401, 'unauthorized')
  })

  it('accepts the previous token inside its 24 hours, and not after', async () => {
    fake.token = {
      hash: sha256(CURRENT),
      prevHash: sha256(PREVIOUS),
      prevValidUntil: new Date(Date.now() + 23 * HOUR_MS),
    }
    expect(await requireBotToken(request(`Bearer ${PREVIOUS}`))).toBeNull()
    expect(await requireBotToken(request(`Bearer ${CURRENT}`))).toBeNull()

    fake.token = { ...fake.token, prevValidUntil: new Date(Date.now() - 1000) }
    await expectDenied(await requireBotToken(request(`Bearer ${PREVIOUS}`)), 401, 'unauthorized')
    expect(await requireBotToken(request(`Bearer ${CURRENT}`))).toBeNull()
  })

  it('compares the digests in constant time (timingSafeEqual), for a right and a wrong token', async () => {
    await requireBotToken(request(`Bearer ${CURRENT}`))
    const calls = crypto.timingSafeEqual.mock.calls.length
    expect(calls).toBeGreaterThan(0)
    for (const [a, b] of crypto.timingSafeEqual.mock.calls) {
      expect((a as Buffer).length).toBe(32)
      expect((b as Buffer).length).toBe(32)
    }
    await requireBotToken(request('Bearer short'))
    expect(crypto.timingSafeEqual.mock.calls.length).toBeGreaterThan(calls)
  })
})

describe('requireBotToken — the rate limit (§2.3: 120 / 10 min per token)', () => {
  it('answers the 121st request in 10 minutes with 429 rate_limited and Retry-After', async () => {
    for (let n = 1; n <= 120; n += 1) {
      expect(await requireBotToken(request(`Bearer ${CURRENT}`)), `request ${n}`).toBeNull()
    }
    const denied = await expectDenied(
      await requireBotToken(request(`Bearer ${CURRENT}`)),
      429,
      'rate_limited',
    )
    const retryAfter = Number(denied.headers.get('retry-after'))
    expect(Number.isInteger(retryAfter)).toBe(true)
    expect(retryAfter).toBeGreaterThan(0)
    expect(retryAfter).toBeLessThanOrEqual(600)
  })

  it('counts per token: a rejected token does not use the valid token’s budget', async () => {
    for (let n = 1; n <= 130; n += 1) {
      await requireBotToken(request(`Bearer hdb_${'C'.repeat(43)}`))
    }
    expect(await requireBotToken(request(`Bearer ${CURRENT}`))).toBeNull()
  })
})
