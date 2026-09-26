import { beforeEach, describe, expect, it, vi } from 'vitest'

const databaseIsHealthy = vi.hoisted(() => vi.fn<() => Promise<boolean>>())
vi.mock('@/lib/ops/health', () => ({ databaseIsHealthy }))

const { GET } = await import('./route')

beforeEach(() => {
  databaseIsHealthy.mockReset()
})

describe('GET /api/health (§2.3: ok / fail only)', () => {
  it('answers 200 {"ok":true} when the database answers', async () => {
    databaseIsHealthy.mockResolvedValue(true)
    const response = await GET()
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('{"ok":true}')
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('answers 503 {"ok":false} when it does not', async () => {
    databaseIsHealthy.mockResolvedValue(false)
    const response = await GET()
    expect(response.status).toBe(503)
    expect(await response.text()).toBe('{"ok":false}')
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('checks the database on every request', async () => {
    databaseIsHealthy.mockResolvedValue(true)
    await GET()
    await GET()
    expect(databaseIsHealthy).toHaveBeenCalledTimes(2)
  })
})
