import { beforeEach, describe, expect, it, vi } from 'vitest'

const env = vi.hoisted(() => ({ cronSecret: undefined as string | undefined }))
const crypto = vi.hoisted(() => ({ timingSafeEqual: vi.fn() }))

vi.mock('@/lib/env', () => ({ serverEnv: () => ({ cronSecret: env.cronSecret }) }))
vi.mock('node:crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:crypto')>()
  crypto.timingSafeEqual.mockImplementation(actual.timingSafeEqual)
  return { ...actual, default: actual, timingSafeEqual: crypto.timingSafeEqual }
})

const { requireCronSecret } = await import('./cron')

const SECRET = 's'.repeat(40)
const request = (authorization?: string) =>
  new Request('https://hocdeu.test/api/cron/maintenance', {
    headers: authorization === undefined ? {} : { authorization },
  })

async function expectUnauthorized(denied: Response | null) {
  expect(denied).not.toBeNull()
  expect(denied?.status).toBe(401)
  expect(denied?.headers.get('cache-control')).toBe('no-store')
  // Never echoes the secret or the header back.
  expect(await denied?.text()).not.toContain(SECRET)
}

beforeEach(() => {
  env.cronSecret = SECRET
  crypto.timingSafeEqual.mockClear()
})

describe('requireCronSecret (§2.3: Authorization: Bearer CRON_SECRET)', () => {
  it('lets the right header through (null: go on)', async () => {
    expect(await requireCronSecret(request(`Bearer ${SECRET}`))).toBeNull()
  })

  it('answers 401 when no secret is configured, even for a header that would match', async () => {
    env.cronSecret = undefined
    await expectUnauthorized(await requireCronSecret(request('Bearer undefined')))
    await expectUnauthorized(await requireCronSecret(request('Bearer ')))
    await expectUnauthorized(await requireCronSecret(request()))
  })

  it('answers 401 without the header', async () => {
    await expectUnauthorized(await requireCronSecret(request()))
  })

  it.each([
    ['a wrong secret of the same length', `Bearer ${'x'.repeat(40)}`],
    ['a shorter secret', `Bearer ${SECRET.slice(1)}`],
    ['a longer secret', `Bearer ${SECRET}x`],
    ['the bare secret', SECRET],
    ['another scheme', `Basic ${SECRET}`],
    ['a lower-case scheme', `bearer ${SECRET}`],
    ['an empty header', ''],
  ])('answers 401 for %s', async (_, authorization) => {
    await expectUnauthorized(await requireCronSecret(request(authorization)))
  })

  it('compares in constant time (timingSafeEqual), for a right and a wrong-length header alike', async () => {
    await requireCronSecret(request(`Bearer ${SECRET}`))
    expect(crypto.timingSafeEqual).toHaveBeenCalledTimes(1)
    await requireCronSecret(request('Bearer short'))
    expect(crypto.timingSafeEqual).toHaveBeenCalledTimes(2)
  })
})
