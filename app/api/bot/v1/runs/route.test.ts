import { beforeEach, describe, expect, it, vi } from 'vitest'

const fake = vi.hoisted(() => ({
  denied: null as Response | null,
  startRun: vi.fn(),
}))
vi.mock('@/lib/auth/bot', () => ({ requireBotToken: vi.fn(async () => fake.denied) }))
vi.mock('@/lib/bot/runs', () => ({ startRun: fake.startRun }))

const { POST } = await import('./route')

const PLAN = {
  runId: 'run_2026-10-05',
  mode: 'dry_run',
  catalogVersion: 'c9f2aa00c9f2aa00',
  rulesVersion: 3,
  contentProposals: false,
  users: ['u_aaaaaaaaaaaaaaaa'],
  deferredUsers: 0,
}

const post = (body: string) =>
  new Request('https://hocdeu.test/api/bot/v1/runs', {
    method: 'POST',
    headers: { authorization: 'Bearer hdb_x', 'content-type': 'application/json' },
    body,
  })

beforeEach(() => {
  fake.denied = null
  fake.startRun.mockReset()
  fake.startRun.mockResolvedValue(PLAN)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('POST /api/bot/v1/runs (§6.4.1)', () => {
  it('answers the guard’s denial first and never reads the body', async () => {
    fake.denied = Response.json({ error: 'disabled' }, { status: 503 })
    const request = post('{"kind":"plan"}')
    const response = await POST(request)
    expect(response.status).toBe(503)
    expect(request.bodyUsed).toBe(false)
    expect(fake.startRun).not.toHaveBeenCalled()
  })

  it('answers 422 invalid with details for a bad body (unknown key, unknown kind)', async () => {
    const response = await POST(post('{"kind":"daily","users":[]}'))
    expect(response.status).toBe(422)
    expect(response.headers.get('cache-control')).toBe('no-store')
    const body = (await response.json()) as { error: string; details: unknown[] }
    expect(body.error).toBe('invalid')
    expect(body.details.length).toBeGreaterThan(0)
    expect(fake.startRun).not.toHaveBeenCalled()
  })

  it('answers 400 invalid_json for a body that is not JSON', async () => {
    const response = await POST(post('kind=plan'))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'invalid_json' })
  })

  it('starts the run (kind defaults to plan) and answers 200, never cached', async () => {
    const response = await POST(post('{"requestedMode":"dry_run"}'))
    expect(fake.startRun).toHaveBeenCalledWith(
      { kind: 'plan', requestedMode: 'dry_run' },
      expect.any(Date),
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual(PLAN)
  })

  it('a failure answers 500 internal, JSON and uncached', async () => {
    fake.startRun.mockRejectedValue(new Error('db down'))
    const response = await POST(post('{}'))
    expect(response.status).toBe(500)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual({ error: 'internal' })
  })
})
