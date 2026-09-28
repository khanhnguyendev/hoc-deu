import { beforeEach, describe, expect, it, vi } from 'vitest'

const pendingPublishTargets = vi.hoisted(() => vi.fn<() => Promise<string[]>>())
vi.mock('@/lib/ops/publish-requests', () => ({ pendingPublishTargets }))

const { GET } = await import('./route')

beforeEach(() => {
  pendingPublishTargets.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('GET /api/content/publish-requests (§2.4, §6.6): public, targets only', () => {
  it('answers 200 {"targets":[…]} with the pending targets, cached for 60 s', async () => {
    pendingPublishTargets.mockResolvedValue(['dsa:lc-0049#note', 'dsa:lc-0146'])
    const response = await GET()
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('{"targets":["dsa:lc-0049#note","dsa:lc-0146"]}')
    expect(response.headers.get('cache-control')).toBe('public, max-age=60')
  })

  it('an empty list is still an answer', async () => {
    pendingPublishTargets.mockResolvedValue([])
    const response = await GET()
    expect(await response.json()).toEqual({ targets: [] })
  })

  it('a database error → 503 {"ok":false}, never cached, nothing else said', async () => {
    pendingPublishTargets.mockRejectedValue(new Error('connection refused at 10.0.0.1'))
    const response = await GET()
    expect(response.status).toBe(503)
    expect(await response.text()).toBe('{"ok":false}')
    expect(response.headers.get('cache-control')).toBe('no-store')
  })
})
