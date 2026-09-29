import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CATALOG as GENERATED } from '@/.generated/catalog'
import { BOT_TABLES, botRecordWrite } from '@/lib/bot/__fixtures__/bot-sql'
import { fakeDb, type FakeDb, type Row } from '@/lib/bot/__fixtures__/fake-db'
import { applyUserItemEvent } from '@/lib/bot/__fixtures__/user-items-sql'
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

const { PUT } = await import('./route')
const { resolveRunUser } = await import('@/lib/bot/runs')

const USER_ID = '00000000-0000-4000-8000-000000000001'
const RUN = 'run_2026-10-05'
const REF = 'u_aaaaaaaaaaaaaaaa'
const KEY = `${RUN}:${REF}:custom-items`
const RUN_USER: RunUser = {
  runUuid: '00000000-0000-4000-8000-000000000100',
  runKey: RUN,
  mode: 'live',
  runUserId: '00000000-0000-4000-8000-000000000200',
  userId: USER_ID,
  userRef: REF,
}
const ITEM = {
  slug: 'ah-card',
  type: 'flashcard',
  trackId: 'dsa',
  topicId: 'arrays-hashing',
  payload: { front: 'two pointers', back: 'hai con trỏ' },
}
const CREATED = 'user:0123456789abcdef:ah-card'

function setup(change: { ai?: boolean; dryRunSetting?: boolean } = {}) {
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
      profiles: [
        {
          id: USER_ID,
          status: 'active',
          ai_personalization: change.ai ?? true,
          bot_ref: '0123456789abcdef',
        },
      ],
      bot_settings: [
        {
          id: true,
          enabled: true,
          dry_run: change.dryRunSetting ?? false,
          content_proposals: false,
          per_run_user_cap: 10,
          limits: {},
          token_hash: null,
          token_prev_hash: null,
          token_prev_valid_until: null,
        },
      ],
      user_tracks: [{ user_id: USER_ID, track_id: 'dsa', status: 'active' }],
      user_items: [],
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
      rpc: { bot_record_write: botRecordWrite, apply_system_event: applyUserItemEvent },
    },
  )
}

const put = (body: unknown, key: string | null = KEY) =>
  new Request(`https://hocdeu.test/api/bot/v1/runs/${RUN}/users/${REF}/custom-items`, {
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
  setup()
  vi.mocked(resolveRunUser).mockClear()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('PUT /api/bot/v1/runs/[runId]/users/[userRef]/custom-items (§6.4.4)', () => {
  it('answers the guard’s denial first, reading nothing', async () => {
    state.denied = Response.json({ error: 'disabled' }, { status: 503 })
    const request = put({ items: [ITEM] })
    const response = await PUT(request, context)
    expect(response.status).toBe(503)
    expect(request.bodyUsed).toBe(false)
    expect(resolveRunUser).not.toHaveBeenCalled()
    expect(state.db.calls).toEqual([])
  })

  it('an unknown run or ref (resolveRunUser, decision 6) → 404 not_found', async () => {
    state.runUser = null
    const response = await PUT(put({ items: [ITEM] }), context)
    expect(response.status).toBe(404)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual({ error: 'not_found' })
  })

  it('a wrong Idempotency-Key → 400, nothing written', async () => {
    const response = await PUT(put({ items: [ITEM] }, `${RUN}:${REF}:plan`), context)
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'invalid_idempotency_key' })
    expect(state.db.tables.user_items).toEqual([])
  })

  it('applies, records the answer, and replays it for the same body without writing again', async () => {
    const first = await PUT(put({ items: [ITEM] }), context)
    expect(first.status).toBe(200)
    expect(first.headers.get('cache-control')).toBe('no-store')
    const body = { outcome: 'applied', created: [CREATED], retired: [] }
    expect(await first.json()).toEqual(body)
    expect(state.db.tables.user_items).toHaveLength(1)
    expect((runUserRow().writes as Row)['custom-items']).toMatchObject({ outcome: 'applied' })

    const replay = await PUT(put({ items: [ITEM] }), context)
    expect(await replay.json()).toEqual(body)
    expect(state.db.calls.filter((call) => call === 'rpc:apply_system_event')).toHaveLength(1)

    const conflict = await PUT(put({ items: [{ ...ITEM, slug: 'other-card' }] }), context)
    expect(conflict.status).toBe(409)
    expect(await conflict.json()).toEqual({ error: 'idempotency_conflict' })
  })

  it('an invalid body is 422 invalid with details, counted, and never binds the key', async () => {
    const bad = await PUT(put({ items: [{ ...ITEM, topicId: 'nope' }] }), context)
    expect(bad.status).toBe(422)
    expect(await bad.json()).toMatchObject({
      outcome: 'invalid',
      details: [expect.objectContaining({ path: 'items.0.topicId', code: 'unknown_topic' })],
    })
    expect(runUserRow().detail).toEqual({ 'custom-items': { invalidAttempts: 1 } })
    expect(runUserRow().writes).toEqual({})
    const fixed = await PUT(put({ items: [ITEM] }), context)
    expect(fixed.status).toBe(200)
  })

  it('a body that is not JSON → 400 invalid_json', async () => {
    const response = await PUT(put('{nope'), context)
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'invalid_json' })
  })

  it('a dry run writes nothing but the proposal, and binds the key as dry_run', async () => {
    state.runUser = { ...RUN_USER, mode: 'dry_run' }
    const response = await PUT(put({ items: [ITEM] }), context)
    expect(await response.json()).toEqual({ outcome: 'dry_run', created: [CREATED], retired: [] })
    expect(state.db.tables.user_items).toEqual([])
    expect(state.db.tables.events).toEqual([])
    expect(runUserRow().detail).toMatchObject({ 'custom-items': { proposal: { items: [ITEM] } } })
    expect((runUserRow().writes as Row)['custom-items']).toMatchObject({ outcome: 'dry_run' })
  })

  it('the AI flag off → 409 ai_off, not recorded', async () => {
    setup({ ai: false })
    const response = await PUT(put({ items: [ITEM] }), context)
    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error: 'ai_off' })
    expect(runUserRow().writes).toEqual({})
    expect(runUserRow().detail).toBeNull()
  })

  it('an unexpected failure → 500 internal, logged as a code only', async () => {
    state.db.rpc.apply_system_event = () => {
      throw new Error('socket hang up for learner text')
    }
    const response = await PUT(put({ items: [ITEM] }), context)
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'internal' })
    const logged = vi.mocked(console.error).mock.calls.flat().join(' ')
    expect(logged).not.toContain('learner text')
  })
})
