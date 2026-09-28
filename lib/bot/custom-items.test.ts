import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CATALOG as GENERATED } from '@/.generated/catalog'
import { toPlanCatalog } from '@/lib/content/plan-catalog'
import { withUserItems, type UserItemRow } from '@/lib/content/user-items'
import type { Enrollment } from '@/lib/domain/plan/types'
import { deriveEventId } from '@/lib/events/ids'
import type { Day } from '@/lib/plans/day'
import { fakeDb, RaisedError, type FakeDb, type Row } from './__fixtures__/fake-db'
import { applyUserItemEvent } from './__fixtures__/user-items-sql'
import type { RunUser } from './runs'

const state = vi.hoisted(() => ({
  db: undefined as unknown as FakeDb,
  day: undefined as unknown as Day,
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db.client }))
vi.mock('@/lib/plans/day', () => ({ loadDay: vi.fn(async () => state.day) }))

const { writeCustomItems, PROPOSAL_BYTES } = await import('./custom-items')

const USER_ID = '00000000-0000-4000-8000-000000000001'
const BOT_REF = '0123456789abcdef'
const TODAY = '2026-10-05'
const NOW = new Date('2026-10-05T03:00:00.000Z')
const RUN_USER: RunUser = {
  runUuid: '00000000-0000-4000-8000-000000000100',
  runKey: 'run_2026-10-05',
  mode: 'live',
  runUserId: '00000000-0000-4000-8000-000000000200',
  userId: USER_ID,
  userRef: 'u_aaaaaaaaaaaaaaaa',
}
const id = (slug: string, ref = BOT_REF) => `user:${ref}:${slug}`

const BASE = toPlanCatalog(GENERATED)
const enrollment = (trackId: 'dsa' | 'english'): Enrollment => ({
  trackId,
  variant: trackId === 'dsa' ? '8w' : '10w',
  status: 'active',
  startDate: '2026-09-01',
  budgetMinutes: trackId === 'dsa' ? 60 : 25,
  newPerDay: null,
  throttle: [],
  weeklyTemplate: BASE.tracks[trackId]!.weeklyTemplate,
  includeBonus: false,
  resetOn: null,
})

const CARD = { front: 'two pointers', back: 'Hai con trỏ đi từ hai đầu' }
const EXERCISE = {
  kind: 'fill-blank',
  instruction: { vi: 'Điền từ còn thiếu', en: 'Fill in the blank' },
  text: 'The release is on {{blank}}.',
  answers: ['hold'],
}
const card = (slug: string, change: Record<string, unknown> = {}) => ({
  slug,
  type: 'flashcard',
  trackId: 'dsa',
  topicId: 'arrays-hashing',
  payload: CARD,
  ...change,
})
const exercise = (slug: string) => ({
  slug,
  type: 'exercise',
  trackId: 'english',
  topicId: 'standup',
  payload: EXERCISE,
})

function stored(slug: string, change: Partial<UserItemRow> = {}): UserItemRow {
  return {
    itemId: id(slug),
    itemType: 'flashcard',
    trackId: 'dsa',
    topicId: 'arrays-hashing',
    payload: { ...CARD, tags: [] },
    status: 'active',
    createdOn: '2026-10-01',
    ...change,
  }
}

function setup(
  options: {
    userItems?: UserItemRow[]
    ai?: boolean
    limits?: Record<string, number>
    events?: Row[]
    tracks?: ('dsa' | 'english')[]
  } = {},
): FakeDb {
  const userItems = options.userItems ?? []
  const tracks = options.tracks ?? ['dsa', 'english']
  state.day = {
    clock: NOW,
    today: TODAY,
    catalog: withUserItems(BASE, userItems, GENERATED.tracks),
    userItems,
    versions: [],
    enrollments: tracks.map(enrollment),
    items: {},
    activeTrackIds: new Set(tracks),
  }
  state.db = fakeDb(
    {
      profiles: [
        {
          id: USER_ID,
          status: 'active',
          ai_personalization: options.ai ?? true,
          bot_ref: BOT_REF,
        },
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
      user_items: userItems.map((row) => ({
        user_id: USER_ID,
        item_id: row.itemId,
        item_type: row.itemType,
        track_id: row.trackId,
        topic_id: row.topicId,
        payload: row.payload,
        status: row.status,
        created_on: row.createdOn,
      })),
      events: options.events ?? [],
      bot_run_users: [
        {
          id: RUN_USER.runUserId,
          run_id: RUN_USER.runUuid,
          user_id: USER_ID,
          user_ref: RUN_USER.userRef,
          writes: {},
          detail: { 'custom-items': { invalidAttempts: 1 } },
        },
      ],
    },
    { rpc: { apply_system_event: applyUserItemEvent } },
  )
  return state.db
}

const write = (body: unknown, runUser: RunUser = RUN_USER) => writeCustomItems(runUser, body, NOW)
const writes = (db: FakeDb) => db.calls.filter((call) => call === 'rpc:apply_system_event')
type Detail = { path: string; code: string; message: string }
const details = (answer: Awaited<ReturnType<typeof write>>) =>
  ('details' in answer.body ? answer.body.details : []) as Detail[]
const codes = (answer: Awaited<ReturnType<typeof write>>) => details(answer).map((d) => d.code)

beforeEach(() => {
  setup()
})

describe('writeCustomItems — live (§6.4.4)', () => {
  it('creates the items under the server’s IDs and retires the user’s own', async () => {
    const db = setup({ userItems: [stored('old-drill')] })
    const answer = await write({
      items: [card('ah-card'), exercise('standup-drill')],
      retire: [id('old-drill')],
    })
    expect(answer).toEqual({
      status: 200,
      body: {
        outcome: 'applied',
        created: [id('ah-card'), id('standup-drill')],
        retired: [id('old-drill')],
      },
      outcome: 'applied',
    })
    const rows = db.tables.user_items!
    expect(rows.find((row) => row.item_id === id('old-drill'))?.status).toBe('retired')
    expect(rows.find((row) => row.item_id === id('ah-card'))).toMatchObject({
      item_type: 'flashcard',
      track_id: 'dsa',
      topic_id: 'arrays-hashing',
      payload: { ...CARD, tags: [] },
      created_by_run: 'run_2026-10-05',
    })
    // The exercise is stored with the track's roadmap week at creation (decision 17a).
    expect(rows.find((row) => row.item_id === id('standup-drill'))?.payload).toMatchObject({
      week: 1,
      kind: 'fill-blank',
    })
    // Event ids: the run's namespace, the ref, the kind and the slug / the retired ID — no hash.
    expect(db.tables.events!.map((row) => row.id)).toEqual([
      deriveEventId(RUN_USER.runUuid, `u_aaaaaaaaaaaaaaaa:custom-items:retire:${id('old-drill')}`),
      deriveEventId(RUN_USER.runUuid, 'u_aaaaaaaaaaaaaaaa:custom-items:ah-card'),
      deriveEventId(RUN_USER.runUuid, 'u_aaaaaaaaaaaaaaaa:custom-items:standup-drill'),
    ])
  })

  it('the same slug and payload again is a no-op, listed in created (§6.4.4)', async () => {
    const db = setup({ userItems: [stored('ah-card')] })
    const answer = await write({ items: [card('ah-card')] })
    expect(answer.body).toEqual({ outcome: 'applied', created: [id('ah-card')], retired: [] })
    expect(writes(db)).toEqual([])
  })

  it('a slug in use by another item is invalid', async () => {
    setup({ userItems: [stored('ah-card')] })
    const answer = await write({ items: [card('ah-card', { payload: { ...CARD, back: 'khác' } })] })
    expect(answer.status).toBe(422)
    expect(codes(answer)).toEqual(['slug_taken'])
  })

  it('a replayed write (a crash after it landed) is a duplicate, answered applied', async () => {
    const db = setup()
    await write({ items: [card('ah-card')] })
    db.tables.user_items = []
    expect((await write({ items: [card('ah-card')] })).body).toMatchObject({ outcome: 'applied' })
    expect(db.tables.events).toHaveLength(1)
  })
})

describe('writeCustomItems — validation, all or nothing', () => {
  it.each([
    [
      'a type the track does not list (DSA exercise, §6.10)',
      { ...exercise('x-drill'), trackId: 'dsa', topicId: 'arrays-hashing' },
      'type_not_in_track',
    ],
    ['a topic not in the track', card('ah-card', { topicId: 'standup' }), 'unknown_topic'],
    [
      'a track the learner is not in',
      card('ah-card', { trackId: 'system-design' }),
      'not_enrolled',
    ],
    ['markup', card('ah-card', { payload: { ...CARD, back: '<b>bold</b>' } }), 'not_plain_text'],
    [
      'a URL',
      card('ah-card', { payload: { ...CARD, back: 'see https://leetcode.com' } }),
      'not_plain_text',
    ],
    ['www.', card('ah-card', { payload: { ...CARD, hint: 'www.example.com' } }), 'not_plain_text'],
    [
      'a control character',
      card('ah-card', { payload: { ...CARD, front: 'a\u0007b' } }),
      'not_plain_text',
    ],
    [
      'a server-owned field',
      card('ah-card', { payload: { ...CARD, tier: 'core' } }),
      'invalid_payload',
    ],
    ['provenance', card('ah-card', { payload: { ...CARD, origin: 'bot' } }), 'invalid_payload'],
    [
      'an unknown payload key',
      card('ah-card', { payload: { ...CARD, week: 2 } }),
      'invalid_payload',
    ],
    [
      'a payload over 2 KB',
      card('ah-card', { payload: { ...CARD, back: 'x'.repeat(2100) } }),
      'too_large',
    ],
  ])('refuses %s', async (_, item, code) => {
    const db = setup()
    const answer = await write({ items: [item] })
    expect(answer).toMatchObject({ status: 422, outcome: 'invalid' })
    expect(answer.body).toMatchObject({ outcome: 'invalid', created: [], retired: [] })
    expect(codes(answer)).toContain(code)
    expect(writes(db)).toEqual([])
  })

  it('writes nothing when one item of several is invalid, and reports every issue', async () => {
    const db = setup({ userItems: [stored('old-drill')] })
    const answer = await write({
      items: [
        card('good-card'),
        card('bad-card', { payload: { ...CARD, back: '<i>x</i>' } }),
        card('bad-topic', { topicId: 'nope' }),
      ],
      retire: [id('old-drill')],
    })
    expect(answer.outcome).toBe('invalid')
    expect(details(answer).map((detail) => detail.path)).toEqual([
      'items.1.payload.back',
      'items.2.topicId',
    ])
    expect(writes(db)).toEqual([])
    expect(db.tables.user_items![0]!.status).toBe('active')
  })

  it("refuses to retire another learner's item, or one that does not exist", async () => {
    const db = setup({ userItems: [stored('mine')] })
    const answer = await write({
      items: [],
      retire: [id('mine'), id('theirs', 'fedcba9876543210')],
    })
    expect(codes(answer)).toEqual(['not_own_item'])
    expect(details(answer)[0]).toMatchObject({ path: 'retire.1' })
    expect(writes(db)).toEqual([])
  })

  it('refuses a slug listed twice, and a body the contract refuses', async () => {
    expect(codes(await write({ items: [card('same-card'), card('same-card')] }))).toEqual([
      'duplicate_slug',
    ])
    const empty = await write({ items: [] })
    expect(empty).toMatchObject({ status: 422, outcome: 'invalid' })
    const unknownKey = await write({ items: [card('ah-card', { extra: 1 })] })
    expect(unknownKey.outcome).toBe('invalid')
  })
})

describe('writeCustomItems — quotas (decision 33)', () => {
  const createdToday = (n: number): Row[] =>
    Array.from({ length: n }, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      user_id: USER_ID,
      type: 'user_item.created',
      local_day: TODAY,
    }))

  it('at most 10 new items a local day', async () => {
    const db = setup({ events: createdToday(9) })
    const answer = await write({ items: [card('one-card'), card('two-card')] })
    expect(details(answer)).toEqual([
      expect.objectContaining({ code: 'limit_reached', limit: 10, count: 11 }),
    ])
    expect(writes(db)).toEqual([])
    expect((await write({ items: [card('one-card')] })).outcome).toBe('applied')
  })

  it('bot_settings.limits may lower it', async () => {
    setup({ limits: { customItemsPerDay: 1 } })
    expect(codes(await write({ items: [card('one-card'), card('two-card')] }))).toEqual([
      'limit_reached',
    ])
  })

  it('at most 200 active items; a retirement in the same request frees a place', async () => {
    const full = Array.from({ length: 200 }, (_, index) => stored(`card-${index}`))
    setup({ userItems: full })
    expect(codes(await write({ items: [card('new-card')] }))).toEqual(['limit_reached'])
    const answer = await write({ items: [card('new-card')], retire: [id('card-0')] })
    expect(answer.body).toMatchObject({ outcome: 'applied', retired: [id('card-0')] })
  })

  it("the database's own refusal (a concurrent write took the last place) is invalid", async () => {
    const db = setup()
    // fake-db answers a RaisedError as PostgREST does: { error: { message: <code> } }.
    db.rpc.apply_system_event = () => {
      throw new RaisedError('limit_reached')
    }
    const answer = await write({ items: [card('ah-card')] })
    expect(answer).toMatchObject({ status: 422, outcome: 'invalid' })
    expect(codes(answer)).toEqual(['limit_reached'])
  })
})

describe('writeCustomItems — dry run and the AI flag', () => {
  it('a dry run validates, stores the proposal in detail and writes nothing else (decision 11)', async () => {
    const db = setup()
    const body = { items: [card('ah-card')] }
    const answer = await write(body, { ...RUN_USER, mode: 'dry_run' })
    expect(answer).toEqual({
      status: 200,
      body: { outcome: 'dry_run', created: [id('ah-card')], retired: [] },
      outcome: 'dry_run',
    })
    expect(writes(db)).toEqual([])
    expect(db.tables.user_items).toEqual([])
    expect(db.tables.events).toEqual([])
    expect(db.tables.bot_run_users![0]!.detail).toEqual({
      'custom-items': { invalidAttempts: 1, proposal: { items: [card('ah-card')], retire: [] } },
    })
  })

  it('a dry-run proposal over 16 KB keeps the list without the payloads', async () => {
    const db = setup()
    const big = { ...CARD, back: 'x'.repeat(1900) }
    const items = Array.from({ length: 10 }, (_, index) => card(`card-${index}`, { payload: big }))
    expect((await write({ items }, { ...RUN_USER, mode: 'dry_run' })).outcome).toBe('dry_run')
    const proposal = (db.tables.bot_run_users![0]!.detail as Record<string, Row>)['custom-items']!
      .proposal as Row
    expect(proposal.payloadsOmitted).toBe(true)
    expect(JSON.stringify(proposal).length).toBeLessThan(PROPOSAL_BYTES)
  })

  it('an invalid dry run is invalid too, and records no proposal', async () => {
    const db = setup()
    const answer = await write(
      { items: [card('x', { topicId: 'nope' })] },
      { ...RUN_USER, mode: 'dry_run' },
    )
    expect(answer.outcome).toBe('invalid')
    expect(db.tables.bot_run_users![0]!.detail).toEqual({ 'custom-items': { invalidAttempts: 1 } })
  })

  it('the AI flag off → 409 ai_off, not recorded (no outcome), nothing read or written', async () => {
    const db = setup({ ai: false })
    expect(await write({ items: [card('ah-card')] })).toEqual({
      status: 409,
      body: { error: 'ai_off' },
    })
    expect(writes(db)).toEqual([])
  })
})
