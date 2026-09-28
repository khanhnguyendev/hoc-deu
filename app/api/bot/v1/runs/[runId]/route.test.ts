import { beforeEach, describe, expect, it, vi } from 'vitest'

const fake = vi.hoisted(() => ({
  denied: null as Response | null,
  finishRun: vi.fn(),
}))
vi.mock('@/lib/auth/bot', () => ({ requireBotToken: vi.fn(async () => fake.denied) }))
vi.mock('@/lib/bot/runs', () => ({ finishRun: fake.finishRun }))

const { PATCH } = await import('./route')

const RUN = 'run_2026-10-05_publish-1'
const PR = 'https://github.com/khanhnguyendev/hoc-deu/pull/41'

const patch = (body: string) =>
  new Request(`https://hocdeu.test/api/bot/v1/runs/${RUN}`, {
    method: 'PATCH',
    headers: { authorization: 'Bearer hdb_x' },
    body,
  })
const context = (runId = RUN) => ({ params: Promise.resolve({ runId }) })

beforeEach(() => {
  fake.denied = null
  fake.finishRun.mockReset()
  fake.finishRun.mockResolvedValue({ outcome: 'ok', ignored: [] })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('PATCH /api/bot/v1/runs/[runId] (§6.4.6)', () => {
  it('answers the guard’s denial first and never reads the body', async () => {
    fake.denied = Response.json({ error: 'unauthorized' }, { status: 401 })
    const request = patch('{"status":"completed"}')
    const response = await PATCH(request, context())
    expect(response.status).toBe(401)
    expect(request.bodyUsed).toBe(false)
    expect(fake.finishRun).not.toHaveBeenCalled()
  })

  it('answers 422 invalid with details for a bad body', async () => {
    const response = await PATCH(
      patch(`{"status":"completed","contentPrUrl":"https://example.com/pull/1"}`),
      context(),
    )
    expect(response.status).toBe(422)
    const body = (await response.json()) as { error: string; details: { path: string }[] }
    expect(body.error).toBe('invalid')
    expect(body.details.map((detail) => detail.path)).toContain('contentPrUrl')
    expect(fake.finishRun).not.toHaveBeenCalled()
  })

  it('an unknown run → 404 not_found', async () => {
    fake.finishRun.mockResolvedValue({ outcome: 'not_found' })
    const response = await PATCH(patch('{"status":"failed"}'), context('run_2026-10-09'))
    expect(response.status).toBe(404)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual({ error: 'not_found' })
  })

  it('finishes the run: 200 { ok: true }, the ignored request ids in details', async () => {
    const response = await PATCH(
      patch(`{"status":"completed","contentPrUrl":"${PR}","publishRequestIds":[17]}`),
      context(),
    )
    expect(fake.finishRun).toHaveBeenCalledWith(
      RUN,
      { status: 'completed', contentPrUrl: PR, publishRequestIds: [17] },
      expect.any(Date),
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual({ ok: true })

    fake.finishRun.mockResolvedValue({
      outcome: 'ok',
      ignored: [{ requestId: 18, reason: 'not_pending' }],
    })
    const withIgnored = await PATCH(patch('{"status":"completed"}'), context())
    expect(await withIgnored.json()).toEqual({
      ok: true,
      details: [{ requestId: 18, reason: 'not_pending' }],
    })
  })

  it('a failure answers 500 internal', async () => {
    fake.finishRun.mockRejectedValue(new Error('db down'))
    const response = await PATCH(patch('{"status":"completed"}'), context())
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'internal' })
  })
})
