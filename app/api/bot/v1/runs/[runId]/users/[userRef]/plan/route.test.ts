import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BOT_TABLES, botRecordWrite } from '@/lib/bot/__fixtures__/bot-sql'
import { fakeDb, type FakeDb, type Row } from '@/lib/bot/__fixtures__/fake-db'
import type { RunUser } from '@/lib/bot/runs'

const state = vi.hoisted(() => ({
  denied: null as Response | null,
  runUser: null as RunUser | null,
  db: undefined as unknown as FakeDb,
}))
vi.mock('@/lib/auth/bot', () => ({ requireBotToken: vi.fn(async () => state.denied) }))
vi.mock('@/lib/bot/runs', () => ({ resolveRunUser: vi.fn(async () => state.runUser) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db.client }))
vi.mock('@/lib/bot/plan', () => ({
  writePlan: vi.fn(async (_runUser: RunUser, body: unknown) =>
    body !== null && typeof body === 'object' && 'extra' in body
      ? {
          status: 422,
          body: { outcome: 'invalid', details: [{ code: 'unrecognized_keys' }] },
          outcome: 'invalid',
        }
      : { status: 200, body: { outcome: 'applied', planVersion: 2 }, outcome: 'applied' },
  ),
}))

const { PUT } = await import('./route')
const { resolveRunUser } = await import('@/lib/bot/runs')
const { writePlan } = await import('@/lib/bot/plan')

const RUN = 'run_2026-10-05'
const REF = 'u_aaaaaaaaaaaaaaaa'
const KEY = `${RUN}:${REF}:plan`
const RUN_USER: RunUser = {
  runUuid: '00000000-0000-4000-8000-000000000100',
  runKey: RUN,
  mode: 'live',
  runUserId: '00000000-0000-4000-8000-000000000200',
  userId: '00000000-0000-4000-8000-000000000001',
  userRef: REF,
}
const BODY = {
  targetDate: '2026-10-05',
  blocks: [{ trackId: 'dsa', kind: 'new', itemIds: ['dsa:lc-0003'] }],
  rationale: 'Học tiếp.',
}

const put = (body: unknown, key: string | null = KEY) =>
  new Request(`https://hocdeu.test/api/bot/v1/runs/${RUN}/users/${REF}/plan`, {
    method: 'PUT',
    headers: {
      authorization: 'Bearer hdb_x',
      ...(key === null ? {} : { 'Idempotency-Key': key }),
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
const context = { params: Promise.resolve({ runId: RUN, userRef: REF }) }
const runUserRow = () => state.db.tables.bot_run_users![0] as Row

beforeEach(() => {
  state.denied = null
  state.runUser = RUN_USER
  state.db = fakeDb(
    {
      bot_run_users: [
        {
          id: RUN_USER.runUserId,
          run_id: RUN_USER.runUuid,
          user_id: RUN_USER.userId,
          user_ref: REF,
          outcome: null,
          writes: {},
          detail: null,
          processed_at: null,
        },
      ],
    },
    { ...BOT_TABLES, rpc: { bot_record_write: botRecordWrite } },
  )
  vi.mocked(resolveRunUser).mockClear()
  vi.mocked(writePlan).mockClear()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('PUT /api/bot/v1/runs/[runId]/users/[userRef]/plan (§6.4.3)', () => {
  it('answers the guard’s denial first, reading nothing', async () => {
    state.denied = Response.json({ error: 'disabled' }, { status: 503 })
    const request = put(BODY)
    const response = await PUT(request, context)
    expect(response.status).toBe(503)
    expect(request.bodyUsed).toBe(false)
    expect(resolveRunUser).not.toHaveBeenCalled()
    expect(state.db.calls).toEqual([])
  })

  it('an unknown run or ref → 404 not_found, never cached', async () => {
    state.runUser = null
    const response = await PUT(put(BODY), context)
    expect(response.status).toBe(404)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual({ error: 'not_found' })
    expect(writePlan).not.toHaveBeenCalled()
  })

  it('a wrong Idempotency-Key → 400, nothing written', async () => {
    const response = await PUT(put(BODY, `${RUN}:${REF}:overrides`), context)
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'invalid_idempotency_key' })
    expect(writePlan).not.toHaveBeenCalled()
  })

  it('applies, records the answer, and replays it for the same body without writing again; another body is 409', async () => {
    const first = await PUT(put(BODY), context)
    expect(first.status).toBe(200)
    expect(first.headers.get('cache-control')).toBe('no-store')
    expect(await first.json()).toEqual({ outcome: 'applied', planVersion: 2 })
    expect(writePlan).toHaveBeenCalledWith(RUN_USER, BODY, expect.any(Date))
    expect(runUserRow().outcome).toBe('applied')

    const replay = await PUT(put(BODY), context)
    expect(await replay.json()).toEqual({ outcome: 'applied', planVersion: 2 })
    expect(writePlan).toHaveBeenCalledTimes(1)

    const conflict = await PUT(put({ ...BODY, rationale: 'Khác.' }), context)
    expect(conflict.status).toBe(409)
    expect(await conflict.json()).toEqual({ error: 'idempotency_conflict' })
  })

  it('a bad body → 422 invalid, counted, never binding the key', async () => {
    const bad = await PUT(put({ ...BODY, extra: 1 }), context)
    expect(bad.status).toBe(422)
    expect(await bad.json()).toMatchObject({ outcome: 'invalid' })
    expect(runUserRow().detail).toEqual({ plan: { invalidAttempts: 1 } })
    expect(runUserRow().writes).toEqual({})
    expect((await PUT(put(BODY), context)).status).toBe(200)
  })

  it('a body that is not JSON → 400 invalid_json', async () => {
    const response = await PUT(put('{nope'), context)
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'invalid_json' })
  })

  it('an unexpected failure → 500 internal, logged as a code only', async () => {
    vi.mocked(writePlan).mockRejectedValueOnce(new Error('learner text in a message'))
    const response = await PUT(put(BODY), context)
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'internal' })
    expect(vi.mocked(console.error).mock.calls.flat().join(' ')).not.toContain('learner text')
  })
})
