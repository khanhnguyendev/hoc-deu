import { beforeEach, describe, expect, it, vi } from 'vitest'

const env = vi.hoisted(() => ({ cronSecret: undefined as string | undefined }))
const runMaintenance = vi.hoisted(() => vi.fn())
vi.mock('@/lib/env', () => ({ serverEnv: () => ({ cronSecret: env.cronSecret }) }))
vi.mock('@/lib/ops/maintenance', () => ({ runMaintenance }))

const { GET } = await import('./route')

const SECRET = 'c'.repeat(48)
const REPORT = { ok: false, steps: { dbSize: 'ok', prune: 'ok', backups: 'failed' } }
const request = (authorization?: string) =>
  new Request('https://hocdeu.test/api/cron/maintenance', {
    headers: authorization === undefined ? {} : { authorization },
  })

beforeEach(() => {
  env.cronSecret = SECRET
  runMaintenance.mockReset()
  runMaintenance.mockResolvedValue(REPORT)
})

describe('GET /api/cron/maintenance (§2.3, ADR-0034)', () => {
  it.each([
    ['no header', undefined],
    ['a wrong secret', `Bearer ${'x'.repeat(48)}`],
  ])('answers 401 before any work: %s', async (_, authorization) => {
    const response = await GET(request(authorization))
    expect(response.status).toBe(401)
    expect(runMaintenance).not.toHaveBeenCalled()
  })

  it('answers 401 while no CRON_SECRET is configured', async () => {
    env.cronSecret = undefined
    const response = await GET(request('Bearer undefined'))
    expect(response.status).toBe(401)
    expect(runMaintenance).not.toHaveBeenCalled()
  })

  it('runs the maintenance once and answers 200 with the report only, never cached', async () => {
    const response = await GET(request(`Bearer ${SECRET}`))
    expect(runMaintenance).toHaveBeenCalledTimes(1)
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual(REPORT)
  })
})
