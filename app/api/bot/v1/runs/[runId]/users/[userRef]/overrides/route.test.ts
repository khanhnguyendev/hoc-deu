import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CATALOG as GENERATED } from '@/.generated/catalog'
import { BOT_TABLES, botRecordWrite } from '@/lib/bot/__fixtures__/bot-sql'
import { fakeDb, type FakeDb, type Row } from '@/lib/bot/__fixtures__/fake-db'
import { applyOverrideEvent, overrideRowsOf } from '@/lib/bot/__fixtures__/overrides-sql'
import type { RunUser } from '@/lib/bot/runs'
import { toPlanCatalog } from '@/lib/content/plan-catalog'
import type { Day } from '@/lib/plans/day'

const state = vi.hoisted(() => ({
  denied: null as Response | null,
  runUser: null as RunUser | null,
  db: undefined as unknown as FakeDb,
  day: undefined as unknown as Day,
}))
vi.mock('@/lib/auth/bot', () => ({ requireBotToken: vi.fn(async () => state.denied) }))
vi.mock('@/lib/bot/runs', () => ({ resolveRunUser: vi.fn(async () => state.runUser) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db.client }))
vi.mock('@/lib/plans/day', () => ({ loadDay: vi.fn(async () => state.day) }))
vi.mock('@/lib/plans/reads', () => ({
  readOverrideRows: vi.fn(async (_client: unknown, userId: string, today: string) =>
    overrideRowsOf(state.db, userId, today),
  ),
}))

const { PUT } = await import('./route')
const { resolveRunUser } = await import('@/lib/bot/runs')

const USER_ID = '00000000-0000-4000-8000-000000000001'
const RUN = 'run_2026-10-05'
const REF = 'u_aaaaaaaaaaaaaaaa'
const KEY = `${RUN}:${REF}:overrides`
const RUN_USER: RunUser = {
  runUuid: '00000000-0000-4000-8000-000000000100',
  runKey: RUN,
  mode: 'live',
  runUserId: '00000000-0000-4000-8000-000000000200',
  userId: USER_ID,
  userRef: REF,
}
const INSERT = {
  key: 'ah-extra-practice',
  kind: 'insert_block',
  trackId: 'dsa',
  params: {
    topicId: 'arrays-hashing',
    weekdays: ['mon', 'wed', 'fri'],
    minutes: 15,
    until: '2026-10-19',
  },
}
const ACTIVE = [{ trackId: 'dsa', key: 'ah-extra-practice' }]

function setup(change: { ai?: boolean; overrides?: Row[] } = {}) {
  const catalog = toPlanCatalog(GENERATED)
  state.denied = null
  state.runUser = RUN_USER
  state.day = {
    clock: new Date(),
    today: '2026-10-05',
    catalog,
    userItems: [],
    versions: [],
    enrollments: [
      {
        trackId: 'dsa',
        variant: '8w',
        status: 'active',
        startDate: '2026-09-01',
        budgetMinutes: 60,
        newPerDay: null,
        throttle: [],
        weeklyTemplate: catalog.tracks.dsa!.weeklyTemplate,
        includeBonus: false,
        resetOn: null,
      },
    ],
    items: {},
    activeTrackIds: new Set(['dsa']),
  }
  state.db = fakeDb(
    {
      profiles: [{ id: USER_ID, status: 'active', ai_personalization: change.ai ?? true }],
      bot_settings: [
        {
          id: true,
          enabled: true,
          dry_run: false,
          content_proposals: false,
          per_run_user_cap: 10,
          limits: {},
          token_hash: null,
          token_prev_hash: null,
          token_prev_valid_until: null,
        },
      ],
      user_tracks: [{ user_id: USER_ID, track_id: 'dsa', status: 'active' }],
      roadmap_overrides: change.overrides ?? [],
      day_plans: [],
      events: [],
      bot_run_users: [
        {
          id: RUN_USER.runUserId,
          run_id: RUN_USER.runUuid,
          user_id: USER_ID,
          user_ref: REF,
          outcome: null,
          writes: {},
          detail: null,
          processed_at: null,
        },
      ],
    },
    {
      ...BOT_TABLES,
      rpc: { bot_record_write: botRecordWrite, apply_system_event: applyOverrideEvent },
    },
  )
}

const put = (body: unknown, key: string | null = KEY) =>
  new Request(`https://hocdeu.test/api/bot/v1/runs/${RUN}/users/${REF}/overrides`, {
    method: 'PUT',
    headers: {
      authorization: 'Bearer hdb_x',
      ...(key === null ? {} : { 'Idempotency-Key': key }),
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
const context = { params: Promise.resolve({ runId: RUN, userRef: REF }) }
const runUserRow = () => state.db.tables.bot_run_users![0] as Row
const eventWrites = () => state.db.calls.filter((call) => call === 'rpc:apply_system_event')

beforeEach(() => {
  setup()
  vi.mocked(resolveRunUser).mockClear()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('PUT /api/bot/v1/runs/[runId]/users/[userRef]/overrides (§6.4.5)', () => {
  it('answers the guard’s denial first, reading nothing', async () => {
    state.denied = Response.json({ error: 'disabled' }, { status: 503 })
    const request = put({ set: [INSERT] })
    const response = await PUT(request, context)
    expect(response.status).toBe(503)
    expect(request.bodyUsed).toBe(false)
    expect(resolveRunUser).not.toHaveBeenCalled()
    expect(state.db.calls).toEqual([])
  })

  it('an unknown run or ref (resolveRunUser, decision 6) → 404 not_found', async () => {
    state.runUser = null
    const response = await PUT(put({ set: [INSERT] }), context)
    expect(response.status).toBe(404)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual({ error: 'not_found' })
  })

  it('a wrong Idempotency-Key → 400, nothing written', async () => {
    const response = await PUT(put({ set: [INSERT] }, `${RUN}:${REF}:plan`), context)
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'invalid_idempotency_key' })
    expect(eventWrites()).toEqual([])
  })

  it('applies, records the answer, and replays it for the same body without writing again', async () => {
    const first = await PUT(put({ set: [INSERT] }), context)
    expect(first.status).toBe(200)
    expect(first.headers.get('cache-control')).toBe('no-store')
    const body = { outcome: 'applied', active: ACTIVE }
    expect(await first.json()).toEqual(body)
    expect((runUserRow().writes as Row).overrides).toMatchObject({ outcome: 'applied' })

    const replay = await PUT(put({ set: [INSERT] }), context)
    expect(await replay.json()).toEqual(body)
    expect(eventWrites()).toHaveLength(1)

    const conflict = await PUT(put({ set: [{ ...INSERT, key: 'other-key' }] }), context)
    expect(conflict.status).toBe(409)
    expect(await conflict.json()).toEqual({ error: 'idempotency_conflict' })
  })

  it('an invalid body is 422 invalid with details, counted, and never binds the key', async () => {
    const bad = await PUT(
      put({ set: [{ ...INSERT, params: { ...INSERT.params, minutes: 16 } }] }),
      context,
    )
    expect(bad.status).toBe(422)
    expect(await bad.json()).toEqual({
      outcome: 'invalid',
      active: [],
      details: [expect.objectContaining({ path: 'set.0', code: 'over_budget_share' })],
    })
    expect(runUserRow().detail).toEqual({ overrides: { invalidAttempts: 1 } })
    expect(runUserRow().writes).toEqual({})
    const fixed = await PUT(put({ set: [INSERT] }), context)
    expect(fixed.status).toBe(200)
  })

  it('revoking an unknown key is invalid', async () => {
    const response = await PUT(put({ revoke: [{ trackId: 'dsa', key: 'nope' }] }), context)
    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({
      outcome: 'invalid',
      details: [expect.objectContaining({ path: 'revoke.0', code: 'unknown_key' })],
    })
  })

  it('a body that is not JSON → 400 invalid_json', async () => {
    const response = await PUT(put('{nope'), context)
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'invalid_json' })
  })

  it('a dry run writes nothing but the proposal, and binds the key as dry_run', async () => {
    state.runUser = { ...RUN_USER, mode: 'dry_run' }
    const response = await PUT(put({ set: [INSERT] }), context)
    expect(await response.json()).toEqual({ outcome: 'dry_run', active: [] })
    expect(state.db.tables.roadmap_overrides).toEqual([])
    expect(state.db.tables.events).toEqual([])
    expect(runUserRow().detail).toMatchObject({
      overrides: { proposal: { set: [INSERT], revoke: [] } },
    })
    expect((runUserRow().writes as Row).overrides).toMatchObject({ outcome: 'dry_run' })
  })

  it('the AI flag off → 409 ai_off, not recorded', async () => {
    setup({ ai: false })
    const response = await PUT(put({ set: [INSERT] }), context)
    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error: 'ai_off' })
    expect(runUserRow().writes).toEqual({})
    expect(runUserRow().detail).toBeNull()
  })

  it('an unexpected failure → 500 internal, logged as a code only', async () => {
    state.db.rpc.apply_system_event = () => {
      throw new Error('socket hang up for learner text')
    }
    const response = await PUT(put({ set: [INSERT] }), context)
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'internal' })
    const logged = vi.mocked(console.error).mock.calls.flat().join(' ')
    expect(logged).not.toContain('learner text')
  })
})
