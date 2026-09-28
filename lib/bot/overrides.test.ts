import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CATALOG as GENERATED } from '@/.generated/catalog'
import { toPlanCatalog } from '@/lib/content/plan-catalog'
import type { Enrollment } from '@/lib/domain/plan/types'
import type { ItemState } from '@/lib/domain/state'
import { deriveEventId, digest } from '@/lib/events/ids'
import type { Day } from '@/lib/plans/day'
import { fakeDb, type FakeDb, type Row } from './__fixtures__/fake-db'
import { applyOverrideEvent, overrideRowsOf } from './__fixtures__/overrides-sql'
import type { RunUser } from './runs'

const state = vi.hoisted(() => ({
  db: undefined as unknown as FakeDb,
  day: undefined as unknown as Day,
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db.client }))
vi.mock('@/lib/plans/day', () => ({ loadDay: vi.fn(async () => state.day) }))
vi.mock('@/lib/plans/reads', () => ({
  readOverrideRows: vi.fn(async (_client: unknown, userId: string, today: string) =>
    overrideRowsOf(state.db, userId, today),
  ),
}))

const { writeOverrides } = await import('./overrides')

const USER_ID = '00000000-0000-4000-8000-000000000001'
const TODAY = '2026-10-05' // a Monday
const NOW = new Date('2026-10-05T03:00:00.000Z')
const RUN_USER: RunUser = {
  runUuid: '00000000-0000-4000-8000-000000000100',
  runKey: 'run_2026-10-05',
  mode: 'live',
  runUserId: '00000000-0000-4000-8000-000000000200',
  userId: USER_ID,
  userRef: 'u_aaaaaaaaaaaaaaaa',
}

const BASE = toPlanCatalog(GENERATED)
/** Every not-started DSA topic of a learner in week 1 (`upcomingTopics`, 8w). */
const UPCOMING = [
  'two-pointers',
  'sliding-window',
  'stack',
  'binary-search',
  'linked-list',
  'trees',
  'heap',
  'backtracking',
  'graphs',
  'dp-1d',
  'dp-2d',
  'intervals',
  'greedy',
  'tries',
]
const swap = (order: readonly string[], a: string, b: string) =>
  order.map((topic) => (topic === a ? b : topic === b ? a : topic))

const enrollment = (trackId: 'dsa' | 'english'): Enrollment => ({
  trackId,
  variant: trackId === 'dsa' ? '8w' : '10w',
  status: 'active',
  startDate: '2026-09-28',
  budgetMinutes: trackId === 'dsa' ? 60 : 25,
  newPerDay: null,
  throttle: [],
  weeklyTemplate: BASE.tracks[trackId]!.weeklyTemplate,
  includeBonus: false,
  resetOn: null,
})

const firstArraysItem = Object.values(BASE.items).find(
  (item) =>
    item.trackId === 'dsa' &&
    item.topicId === 'arrays-hashing' &&
    item.srs !== null &&
    item.status === 'active',
)!
const weak: ItemState = {
  itemId: firstArraysItem.id,
  trackId: 'dsa',
  topicId: 'arrays-hashing',
  itemType: firstArraysItem.itemType,
  level: 1,
  weak: true,
  topSuccesses: 0,
  status: 'weak',
  dueOn: TODAY,
  lastResult: 'failed',
  lastResultOn: '2026-10-03',
  introducedOn: '2026-09-29',
  lapses: 1,
  reps: 2,
}

const insert = (key = 'ah-extra-practice', change: Record<string, unknown> = {}) => ({
  key,
  kind: 'insert_block',
  trackId: 'dsa',
  params: {
    topicId: 'arrays-hashing',
    weekdays: ['mon', 'wed', 'fri'],
    minutes: 15,
    until: '2026-10-19',
    ...change,
  },
})
const extra = (key = 'ah-extra-week', change: Record<string, unknown> = {}) => ({
  key,
  kind: 'extra_week',
  trackId: 'dsa',
  params: { topicId: 'arrays-hashing', studyDays: 5, ...change },
})
const reorder = (order: readonly string[], key = 'backtracking-before-heap') => ({
  key,
  kind: 'reorder_topics',
  trackId: 'dsa',
  params: { order },
})

function stored(kind: string, key: string, change: Row = {}): Row {
  return {
    id: crypto.randomUUID(),
    user_id: USER_ID,
    track_id: 'dsa',
    key,
    kind,
    params:
      kind === 'insert_block'
        ? insert(key).params
        : kind === 'extra_week'
          ? extra(key).params
          : { order: UPCOMING },
    status: 'active',
    until_local_day: kind === 'insert_block' ? '2026-10-19' : null,
    study_days: kind === 'extra_week' ? 5 : null,
    start_local_day: '2026-10-01',
    created_by_run: 'run_2026-10-01',
    revoked_at: null,
    revoked_by: null,
    ...change,
  }
}

function setup(
  options: {
    ai?: boolean
    overrides?: Row[]
    plans?: Row[]
    limits?: Record<string, number>
    items?: Record<string, ItemState>
    tracks?: ('dsa' | 'english')[]
    detail?: unknown
  } = {},
): FakeDb {
  const tracks = options.tracks ?? ['dsa', 'english']
  state.day = {
    clock: NOW,
    today: TODAY,
    catalog: BASE,
    userItems: [],
    versions: [],
    enrollments: tracks.map(enrollment),
    items: options.items ?? { [weak.itemId]: weak },
    activeTrackIds: new Set(tracks),
  }
  state.db = fakeDb(
    {
      profiles: [
        { id: USER_ID, status: 'active', ai_personalization: options.ai ?? true, bot_ref: 'x' },
      ],
      bot_settings: [
        {
          id: true,
          enabled: true,
          dry_run: false,
          content_proposals: false,
          per_run_user_cap: 10,
          limits: options.limits ?? {},
          token_hash: null,
          token_prev_hash: null,
          token_prev_valid_until: null,
        },
      ],
      user_tracks: tracks.map((trackId) => ({
        user_id: USER_ID,
        track_id: trackId,
        status: 'active',
      })),
      roadmap_overrides: options.overrides ?? [],
      day_plans: options.plans ?? [],
      events: [],
      bot_run_users: [
        {
          id: RUN_USER.runUserId,
          run_id: RUN_USER.runUuid,
          user_id: USER_ID,
          user_ref: RUN_USER.userRef,
          writes: {},
          detail: options.detail ?? { overrides: { invalidAttempts: 1 } },
        },
      ],
    },
    { rpc: { apply_system_event: applyOverrideEvent } },
  )
  return state.db
}

const write = (body: unknown, runUser: RunUser = RUN_USER) => writeOverrides(runUser, body, NOW)
type Detail = { path: string; code: string; key?: string }
const details = (answer: Awaited<ReturnType<typeof write>>) =>
  ('details' in answer.body ? (answer.body.details ?? []) : []) as Detail[]
const codes = (answer: Awaited<ReturnType<typeof write>>) => details(answer).map((d) => d.code)
const writes = (db: FakeDb) => db.calls.filter((call) => call === 'rpc:apply_system_event')

beforeEach(() => {
  setup()
})

describe('writeOverrides — live (§6.4.5)', () => {
  it('sets the overrides (§6.4.5’s example) and answers the ones in force', async () => {
    const db = setup()
    const order = swap(UPCOMING, 'heap', 'backtracking')
    const answer = await write({ set: [insert(), reorder(order)] })
    expect(answer).toEqual({
      status: 200,
      body: {
        outcome: 'applied',
        active: [
          { trackId: 'dsa', key: 'ah-extra-practice' },
          { trackId: 'dsa', key: 'backtracking-before-heap' },
        ],
      },
      outcome: 'applied',
    })
    expect(db.tables.roadmap_overrides).toEqual([
      expect.objectContaining({
        key: 'ah-extra-practice',
        kind: 'insert_block',
        until_local_day: '2026-10-19',
        start_local_day: TODAY,
        created_by_run: 'run_2026-10-05',
      }),
      expect.objectContaining({ key: 'backtracking-before-heap', params: { order } }),
    ])
    // Event ids: the run's namespace, the ref, the kind, the track, the key and a digest of the
    // kind and params.
    expect(db.tables.events!.map((row) => row.id)).toEqual([
      deriveEventId(
        RUN_USER.runUuid,
        `u_aaaaaaaaaaaaaaaa:overrides:dsa:ah-extra-practice:${digest({
          kind: 'insert_block',
          params: insert().params,
        })}`,
      ),
      deriveEventId(
        RUN_USER.runUuid,
        `u_aaaaaaaaaaaaaaaa:overrides:dsa:backtracking-before-heap:${digest({
          kind: 'reorder_topics',
          params: { order },
        })}`,
      ),
    ])
  })

  it('revokes first (source bot), freeing room for the sets', async () => {
    const db = setup({
      overrides: [
        stored('insert_block', 'one'),
        stored('insert_block', 'two'),
        stored('reorder_topics', 'three'),
      ],
    })
    const answer = await write({ set: [extra()], revoke: [{ trackId: 'dsa', key: 'one' }] })
    expect(answer.status).toBe(200)
    expect(answer.body).toMatchObject({
      active: [
        { trackId: 'dsa', key: 'ah-extra-week' },
        { trackId: 'dsa', key: 'three' },
        { trackId: 'dsa', key: 'two' },
      ],
    })
    expect(db.tables.roadmap_overrides!.find((row) => row.key === 'one')).toMatchObject({
      status: 'revoked',
      revoked_by: 'bot',
    })
    expect(db.tables.events![0]).toMatchObject({
      id: deriveEventId(RUN_USER.runUuid, 'u_aaaaaaaaaaaaaaaa:overrides:revoke:dsa:one'),
      type: 'roadmap.override_revoked',
      source: 'bot',
    })
  })

  it('the same override in force again is a no-op: nothing written, still active', async () => {
    const db = setup({ overrides: [stored('insert_block', 'ah-extra-practice')] })
    const answer = await write({ set: [insert()] })
    expect(answer.body).toEqual({
      outcome: 'applied',
      active: [{ trackId: 'dsa', key: 'ah-extra-practice' }],
    })
    expect(writes(db)).toEqual([])
  })

  it('a key the bot revoked may be set again; revoking a revoked key is a no-op', async () => {
    const db = setup({
      overrides: [
        stored('insert_block', 'ah-extra-practice', { status: 'revoked', revoked_by: 'bot' }),
        stored('insert_block', 'old', { status: 'revoked', revoked_by: 'learner' }),
      ],
    })
    const answer = await write({ set: [insert()], revoke: [{ trackId: 'dsa', key: 'old' }] })
    expect(answer.body).toMatchObject({ outcome: 'applied' })
    expect(db.tables.roadmap_overrides!.find((r) => r.key === 'ah-extra-practice')?.status).toBe(
      'active',
    )
  })

  it('a replayed write (a crash after it landed) is a duplicate, answered applied', async () => {
    const db = setup()
    await write({ set: [insert()] })
    db.tables.roadmap_overrides = []
    expect((await write({ set: [insert()] })).body).toMatchObject({ outcome: 'applied' })
    expect(db.tables.events).toHaveLength(1)
  })
})

describe('writeOverrides — validation, all or nothing (6.6b’s bounds)', () => {
  it.each([
    [
      'minutes over 25 % of the budget (16 of 60)',
      insert('k-ib', { minutes: 16 }),
      'over_budget_share',
    ],
    ['until more than 14 days ahead', insert('k-ib', { until: '2026-10-20' }), 'until_too_far'],
    ['until before today', insert('k-ib', { until: '2026-10-04' }), 'bad_params'],
    ['a topic not in the track', insert('k-ib', { topicId: 'standup' }), 'unknown_topic'],
    ['an unknown param', insert('k-ib', { colour: 'red' }), 'bad_params'],
    ['a weekday twice', insert('k-ib', { weekdays: ['mon', 'mon'] }), 'bad_params'],
    ['an extra week of more than 5 days', extra('k-ew', { studyDays: 6 }), 'too_many_days'],
    [
      'an extra week of a topic without a Weak item',
      extra('k-ew', { topicId: 'stack' }),
      'no_weak_item',
    ],
    [
      'a reorder breaking requires (trees before linked-list, §6.10)',
      reorder(swap(UPCOMING, 'trees', 'linked-list')),
      'breaks_requires',
    ],
    ['a reorder that drops a topic', reorder(UPCOMING.slice(1)), 'not_permutation'],
    ['a reorder moving a started topic', reorder(['arrays-hashing', ...UPCOMING]), 'not_upcoming'],
    [
      'a track the learner is not in',
      { ...insert('k-ib'), trackId: 'system-design' },
      'not_enrolled',
    ],
  ])('%s → invalid (%s)', async (_, entry, code) => {
    const db = setup()
    const answer = await write({ set: [insert('fine-one'), entry] })
    expect(answer.status).toBe(422)
    expect(answer.outcome).toBe('invalid')
    expect(codes(answer)).toContain(code)
    expect(details(answer)[0]?.path).toMatch(/^set\.1(\.|$)/)
    expect(writes(db)).toEqual([])
  })

  it('an English reorder moves nothing: not_reorderable', async () => {
    const answer = await write({
      set: [
        { key: 'en-order', kind: 'reorder_topics', trackId: 'english', params: { order: ['x-y'] } },
      ],
    })
    expect(codes(answer)).toContain('not_reorderable')
  })

  it('a lowered limit (bot_settings.limits) applies: minutes 10 of 60 at a 15 % share', async () => {
    setup({ limits: { insertBlockShare: 0.15 } })
    expect(codes(await write({ set: [insert('k-ib', { minutes: 10 })] }))).toEqual([
      'over_budget_share',
    ])
  })

  it('an unknown revoke key is invalid; nothing is written', async () => {
    const db = setup({ overrides: [stored('insert_block', 'one')] })
    const answer = await write({ set: [insert()], revoke: [{ trackId: 'dsa', key: 'nope' }] })
    expect(codes(answer)).toEqual(['unknown_key'])
    expect(writes(db)).toEqual([])
    expect(answer.body).toMatchObject({ active: [{ trackId: 'dsa', key: 'one' }] })
  })

  it.each([
    ['another kind under the key', stored('reorder_topics', 'ah-extra-practice'), 'kind_changed'],
    [
      'a key the learner revoked',
      stored('insert_block', 'ah-extra-practice', { status: 'revoked', revoked_by: 'learner' }),
      'revoked_key',
    ],
  ])('%s → %s', async (_, row, code) => {
    setup({ overrides: [row] })
    expect(codes(await write({ set: [insert()] }))).toEqual([code])
  })

  it('a key set twice, or set and revoked, is invalid', async () => {
    setup({ overrides: [stored('insert_block', 'ah-extra-practice')] })
    expect(codes(await write({ set: [insert(), insert()] }))).toContain('duplicate_key')
    expect(
      codes(
        await write({ set: [insert()], revoke: [{ trackId: 'dsa', key: 'ah-extra-practice' }] }),
      ),
    ).toContain('set_and_revoke')
  })

  it('a body the contract refuses is invalid with Zod’s issues', async () => {
    expect(codes(await write({ set: [], revoke: [] }))).toEqual(['custom'])
    expect(codes(await write({ set: [{ ...insert(), key: 'X' }] }))).toEqual(['invalid_format'])
    expect(codes(await write({ set: [insert()], extra: 1 }))).toEqual(['unrecognized_keys'])
  })
})

describe('writeOverrides — the counts (decision 33; SQL’s under its lock)', () => {
  it('a fourth override in force in the track is limit_reached (checked before any write)', async () => {
    const db = setup({
      overrides: [
        stored('insert_block', 'one'),
        stored('insert_block', 'two'),
        stored('reorder_topics', 'three'),
      ],
    })
    const answer = await write({ set: [insert()] })
    expect(codes(answer)).toEqual(['limit_reached'])
    expect(writes(db)).toEqual([])
  })

  it('an expired insert block and a used-up extra week do not count (decision 18)', async () => {
    setup({
      overrides: [
        stored('insert_block', 'one', { until_local_day: '2026-10-04' }),
        stored('extra_week', 'two', { start_local_day: '2026-09-01' }),
        stored('reorder_topics', 'three'),
      ],
      plans: ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05'].map((date) => ({
        user_id: USER_ID,
        plan_date: date,
        roadmap_weeks: { dsa: { extraWeek: 'two' } },
      })),
    })
    expect((await write({ set: [insert()] })).body).toMatchObject({ outcome: 'applied' })
  })

  it('a second extra week in force is limit_reached; a new one within 21 days is cooldown', async () => {
    setup({ overrides: [stored('extra_week', 'running')] })
    expect(codes(await write({ set: [extra()] }))).toEqual(['limit_reached', 'cooldown'])
    setup({ overrides: [stored('extra_week', 'old', { status: 'revoked', revoked_by: 'bot' })] })
    expect(codes(await write({ set: [extra()] }))).toEqual(['cooldown'])
  })

  it('the database’s refusal is invalid with its code (the counts are SQL’s)', async () => {
    const db = setup()
    const { RaisedError } = await import('./__fixtures__/fake-db')
    for (const code of ['limit_reached', 'cooldown', 'revoked_key', 'not_enrolled']) {
      db.rpc.apply_system_event = () => {
        throw new RaisedError(code)
      }
      const answer = await write({ set: [insert()] })
      expect(answer.status).toBe(422)
      expect(details(answer)).toEqual([
        expect.objectContaining({ path: 'set.0', code, written: { set: [], revoked: [] } }),
      ])
    }
    db.rpc.apply_system_event = () => {
      throw new RaisedError('ai_off')
    }
    expect(await write({ set: [insert()] })).toEqual({ status: 409, body: { error: 'ai_off' } })
  })
})

describe('writeOverrides — dry run and the AI flag', () => {
  it('a dry run validates, stores the proposal and writes nothing else (decision 11)', async () => {
    const db = setup({ overrides: [stored('insert_block', 'one')] })
    const body = { set: [insert()], revoke: [{ trackId: 'dsa', key: 'one' }] }
    const answer = await write(body, { ...RUN_USER, mode: 'dry_run' })
    expect(answer).toEqual({
      status: 200,
      body: { outcome: 'dry_run', active: [{ trackId: 'dsa', key: 'one' }] },
      outcome: 'dry_run',
    })
    expect(writes(db)).toEqual([])
    expect(db.tables.roadmap_overrides).toHaveLength(1)
    expect(db.tables.bot_run_users![0]!.detail).toEqual({
      overrides: { invalidAttempts: 1, proposal: body },
    })
  })

  it('a dry run of an invalid body is invalid, with no proposal', async () => {
    const db = setup()
    const answer = await write(
      { set: [insert('k-ib', { minutes: 16 })] },
      { ...RUN_USER, mode: 'dry_run' },
    )
    expect(answer.outcome).toBe('invalid')
    expect(db.tables.bot_run_users![0]!.detail).toEqual({ overrides: { invalidAttempts: 1 } })
  })

  it('the AI flag off → 409 ai_off, not recorded, nothing read beyond the profile', async () => {
    const db = setup({ ai: false })
    expect(await write({ set: [insert()] })).toEqual({ status: 409, body: { error: 'ai_off' } })
    expect(writes(db)).toEqual([])
  })
})
