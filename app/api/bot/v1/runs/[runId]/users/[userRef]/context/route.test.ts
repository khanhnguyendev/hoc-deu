import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeDb, type FakeDb } from '@/lib/bot/__fixtures__/fake-db'

const state = vi.hoisted(() => ({
  denied: null as Response | null,
  db: undefined as unknown as FakeDb,
  buildContext: vi.fn(),
}))
vi.mock('@/lib/auth/bot', () => ({ requireBotToken: vi.fn(async () => state.denied) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db.client }))
vi.mock('@/lib/env', () => ({ serverEnv: () => ({ botRefSecret: 'x'.repeat(32) }) }))
vi.mock('@/lib/bot/context', () => ({ buildContext: state.buildContext }))

const { GET } = await import('./route')

const RUN = 'run_2026-10-05'
const REF = 'u_aaaaaaaaaaaaaaaa'
const USER_ID = '00000000-0000-4000-8000-000000000001'
const RUN_UUID = '00000000-0000-4000-8000-000000000100'
const CONTEXT = { targetDate: '2026-10-05', gate: 'open' }

function setup(runStatus = 'running') {
  state.denied = null
  state.db = fakeDb({
    bot_runs: [{ id: RUN_UUID, run_key: RUN, kind: 'plan', mode: 'dry_run', status: runStatus }],
    bot_run_users: [
      {
        id: '00000000-0000-4000-8000-000000000200',
        run_id: RUN_UUID,
        user_id: USER_ID,
        user_ref: REF,
      },
    ],
    bot_settings: [
      {
        id: true,
        enabled: true,
        dry_run: true,
        content_proposals: false,
        per_run_user_cap: 10,
        limits: {},
        token_hash: null,
        token_prev_hash: null,
        token_prev_valid_until: null,
      },
    ],
  })
  state.buildContext.mockReset()
  state.buildContext.mockResolvedValue(CONTEXT)
}

const get = (runId = RUN, userRef = REF) => ({
  request: new Request(`https://hocdeu.test/api/bot/v1/runs/${runId}/users/${userRef}/context`, {
    headers: { authorization: 'Bearer hdb_x' },
  }),
  context: { params: Promise.resolve({ runId, userRef }) },
})

beforeEach(() => {
  setup()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('GET /api/bot/v1/runs/[runId]/users/[userRef]/context (§6.4.2)', () => {
  it('answers the guard’s denial first and reads nothing', async () => {
    state.denied = Response.json({ error: 'disabled' }, { status: 503 })
    const { request, context } = get()
    const response = await GET(request, context)
    expect(response.status).toBe(503)
    expect(state.db.calls).toEqual([])
    expect(state.buildContext).not.toHaveBeenCalled()
  })

  it.each([
    ['an unknown run', 'run_2026-10-04', REF],
    ['an unknown ref', RUN, 'u_bbbbbbbbbbbbbbbb'],
    ['a malformed ref', RUN, 'not-a-ref'],
    ['a malformed run', 'run_x', REF],
  ])('%s → 404 not_found, never cached', async (_name, runId, userRef) => {
    const { request, context } = get(runId, userRef)
    const response = await GET(request, context)
    expect(response.status).toBe(404)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual({ error: 'not_found' })
    expect(state.buildContext).not.toHaveBeenCalled()
  })

  it.each(['completed', 'failed'])('a %s run → 404 not_found', async (status) => {
    setup(status)
    const { request, context } = get()
    const response = await GET(request, context)
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'not_found' })
    expect(state.buildContext).not.toHaveBeenCalled()
  })

  it('answers 200 with the context of the resolved user, never cached', async () => {
    const { request, context } = get()
    const response = await GET(request, context)
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual(CONTEXT)
    expect(state.buildContext).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_ID, userRef: REF, runKey: RUN }),
      expect.any(Date),
    )
  })

  it('a failure → 500 internal, logged by code only', async () => {
    state.buildContext.mockRejectedValue(
      new Error('learner text here', { cause: { code: '42501' } }),
    )
    const { request, context } = get()
    const response = await GET(request, context)
    expect(response.status).toBe(500)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual({ error: 'internal' })
    const logged = vi.mocked(console.error).mock.calls.flat().join(' ')
    expect(logged).toContain('42501')
    expect(logged).not.toContain('learner text')
  })
})
