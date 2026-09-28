import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CATALOG as GENERATED } from '@/.generated/catalog'
import { fakeDb, type FakeDb, type Row } from './__fixtures__/fake-db'
import type { RunUser } from './runs'
import { toPlanCatalog } from '@/lib/content/plan-catalog'
import { customItemId, type UserItemRow, withUserItems } from '@/lib/content/user-items'
import type { PlanCatalog } from '@/lib/domain/catalog'
import type { RoadmapOverride } from '@/lib/domain/plan/overrides'
import type { Enrollment, StoredPlan } from '@/lib/domain/plan/types'
import type { ItemState } from '@/lib/domain/state'
import {
  addDays,
  localDay,
  scheduleAt,
  type LocalDay,
  type ScheduleVersion,
} from '@/lib/domain/time/localDay'
import type { Day, Resolution } from '@/lib/plans/day'
import type { DayPlanRow } from '@/lib/events/plans'

const state = vi.hoisted(() => ({
  db: undefined as unknown as FakeDb,
  day: undefined as unknown as Omit<Day, 'today' | 'clock'>,
  resolution: { kind: 'open' } as unknown,
  overrides: [] as unknown[],
  loadedAt: null as Date | null,
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db.client }))
vi.mock('@/lib/plans/day', () => ({
  // The learner's local day from their schedule at the clock, as the real loadDay computes it.
  loadDay: vi.fn(async (_client: unknown, _userId: string, clock: Date) => {
    state.loadedAt = clock
    return {
      ...state.day,
      clock,
      today: localDay(clock, scheduleAt(state.day.versions, clock)),
    }
  }),
  resolveDay: vi.fn(async () => state.resolution),
  planContext: vi.fn(async (_client: unknown, _userId: string, day: Day) => ({
    planDate: day.today,
    catalog: day.catalog,
    enrollments: day.enrollments,
    items: day.items,
    recapDone: {},
    overrides: state.overrides,
  })),
}))

const { allowanceOf, activeCustomItemIds, buildContext, loadUserDay } = await import('./context')
const { contextResponse } = await import('./contract/context')

const BASE: PlanCatalog = toPlanCatalog(GENERATED)
const USER_ID = '00000000-0000-4000-8000-000000000001'
const PLAN_ID = '00000000-0000-4000-8000-0000000000aa'
const OLD_PLAN_ID = '00000000-0000-4000-8000-0000000000bb'
const BOT_REF = '0123456789abcdef'
const RUN_USER: RunUser = {
  runUuid: '00000000-0000-4000-8000-000000000100',
  runKey: 'run_2026-10-06',
  mode: 'dry_run',
  runUserId: '00000000-0000-4000-8000-000000000200',
  userId: USER_ID,
  userRef: 'u_aaaaaaaaaaaaaaaa',
}
const VIETNAM: ScheduleVersion = {
  timezone: 'Asia/Ho_Chi_Minh',
  dayStartsAt: '04:00',
  effectiveAt: '2026-01-01T00:00:00.000Z',
}
const LOS_ANGELES: ScheduleVersion = { ...VIETNAM, timezone: 'America/Los_Angeles' }
/** 2026-10-05 22:30 UTC: the run's hour — Vietnam is on 2026-10-06 05:30, Los Angeles on
 *  2026-10-05 15:30 (Review Focus 5). Monday in LA, Tuesday in Vietnam. */
const RUN_AT = new Date('2026-10-05T22:30:00.000Z')
const TODAY = '2026-10-06'
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

const dsaCore = (): string[] =>
  BASE.tracks.dsa!.roadmaps['8w']!.weeks.flatMap((week) =>
    week.core.filter((id) => BASE.items[id]?.status === 'active'),
  )
const englishCards = (): string[] =>
  Object.values(BASE.items)
    .filter((item) => item.trackId === 'english' && item.srs !== null && item.status === 'active')
    .map((item) => item.id)
    .toSorted()

function enrollment(trackId: 'dsa' | 'english', change: Partial<Enrollment> = {}): Enrollment {
  const track = BASE.tracks[trackId]!
  return {
    trackId,
    variant: trackId === 'dsa' ? '8w' : '10w',
    status: 'active',
    startDate: '2026-09-01',
    budgetMinutes: trackId === 'dsa' ? 60 : 25,
    newPerDay: track.defaults.newPerDay,
    throttle: track.defaults.throttle,
    weeklyTemplate: track.weeklyTemplate,
    includeBonus: false,
    resetOn: null,
    ...change,
  }
}

function itemState(itemId: string, change: Partial<ItemState> = {}): ItemState {
  const item = BASE.items[itemId]
  if (item === undefined) throw new Error(`no item ${itemId}`)
  return {
    itemId,
    trackId: item.trackId,
    topicId: item.topicId,
    itemType: item.itemType,
    level: 1,
    weak: false,
    topSuccesses: 0,
    status: 'ok',
    dueOn: null,
    lastResult: 'solved',
    lastResultOn: '2026-09-20',
    introducedOn: '2026-09-20',
    lapses: 0,
    reps: 1,
    ...change,
  }
}

const statesOf = (...states: ItemState[]) =>
  Object.fromEntries(states.map((entry) => [entry.itemId, entry]))

const CARD_ID = customItemId(BOT_REF, 'ah-card')
const customRow = (change: Partial<UserItemRow> = {}): UserItemRow => ({
  itemId: CARD_ID,
  itemType: 'flashcard',
  trackId: 'dsa',
  topicId: 'arrays-hashing',
  payload: { front: 'two-pointer invariant', back: 'Hai con trỏ giữ bất biến', tags: [] },
  status: 'active',
  createdOn: '2026-10-01',
  ...change,
})

type DayInput = {
  versions?: ScheduleVersion[]
  enrollments?: Enrollment[]
  items?: Record<string, ItemState>
  userItems?: UserItemRow[]
}

function setDay(input: DayInput = {}) {
  const userItems = input.userItems ?? []
  const enrollments = input.enrollments ?? [enrollment('dsa'), enrollment('english')]
  state.day = {
    catalog: userItems.length === 0 ? BASE : withUserItems(BASE, userItems, GENERATED.tracks),
    userItems,
    versions: input.versions ?? [VIETNAM],
    enrollments,
    items: input.items ?? {},
    activeTrackIds: new Set(
      enrollments.filter((entry) => entry.status === 'active').map((entry) => entry.trackId),
    ),
  }
}

function planRow(change: Partial<DayPlanRow> = {}): DayPlanRow {
  return {
    id: PLAN_ID,
    user_id: USER_ID,
    plan_date: TODAY,
    version: 1,
    source: 'baseline',
    seen_at: null,
    blocks: [],
    roadmap_weeks: {},
    rules_version: 3,
    ...change,
  } as unknown as DayPlanRow
}

const storedPlan = (change: Partial<StoredPlan> = {}): StoredPlan => ({
  id: PLAN_ID,
  planDate: TODAY,
  version: 1,
  source: 'baseline',
  seenAt: null,
  blocks: [],
  tracks: {},
  ...change,
})

function setDb(change: { share?: boolean; tables?: Record<string, Row[]> } = {}) {
  state.db = fakeDb({
    profiles: [
      {
        id: USER_ID,
        display_name: 'Nguyễn Văn Bí Mật',
        avatar_url: 'https://avatars.example/secret.png',
        bot_ref: BOT_REF,
        ai_personalization: true,
        share_notes_with_ai: change.share ?? false,
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
    events: [],
    daily_activity: [],
    plan_block_state: [],
    ...change.tables,
  })
}

function noteRow(day: LocalDay, note: string | null, n = 1, kind = 'new'): Row {
  return {
    user_id: USER_ID,
    plan_id: PLAN_ID,
    block_id: `${day}:dsa:${kind}:${n}`,
    track_id: 'dsa',
    status: 'done',
    minutes: 20,
    note,
    auto: false,
    checked_in_on: day,
    checked_in_at: `${day}T10:0${n}:00.000Z`,
    version: 1,
    rules_version: 3,
  }
}

function event(type: string, day: LocalDay, change: Row = {}): Row {
  return {
    id: crypto.randomUUID(),
    user_id: USER_ID,
    actor_id: USER_ID,
    type,
    local_day: day,
    occurred_at: `${day}T08:00:00.000Z`,
    item_id: null,
    plan_id: PLAN_ID,
    block_id: null,
    track_id: 'dsa',
    payload: {},
    source: 'web',
    rules_version: 3,
    ...change,
  }
}

beforeEach(() => {
  state.resolution = { kind: 'open' }
  state.overrides = []
  setDay()
  setDb()
})

/** Every key path of `value`: object keys joined by `.`, array elements as `[]`. */
function keyPaths(value: unknown, prefix = ''): Set<string> {
  const paths = new Set<string>()
  const walk = (node: unknown, path: string) => {
    if (Array.isArray(node)) {
      node.forEach((element) => walk(element, `${path}[]`))
    } else if (node !== null && typeof node === 'object') {
      for (const [key, child] of Object.entries(node)) {
        // Records keyed by track or day: their keys are data, not fields.
        const recordParent = /(minutesByTrack|remainingActive)$/.test(path)
        const next = recordParent ? `${path}.*` : path === '' ? key : `${path}.${key}`
        paths.add(next)
        walk(child, next)
      }
    }
  }
  walk(value, prefix)
  return paths
}

/** §6.4.2, field for field — nothing else may ever appear. */
const ALLOWED_PATHS = new Set([
  'targetDate',
  'gate',
  'existingPlan',
  'existingPlan.source',
  'existingPlan.checkedInBlocks',
  'tracks',
  ...[
    'trackId',
    'roadmapVariant',
    'roadmapWeek',
    'budgetMinutes',
    'templateToday',
    'effectiveNewPerDay',
    'throttleReason',
    'upcomingTopics',
  ].map((key) => `tracks[].${key}`),
  ...['kind', 'maxMinutes', 'minutes', 'count', 'tag', 'itemType', 'topicId'].map(
    (key) => `tracks[].templateToday[].${key}`,
  ),
  'baselinePlan',
  'baselinePlan.blocks',
  ...[
    'id',
    'trackId',
    'kind',
    'estMinutes',
    'items',
    'tag',
    'itemType',
    'recapWeek',
    'shadowing',
  ].map((key) => `baselinePlan.blocks[].${key}`),
  ...['itemId', 'mode', 'minutes', 'overBudget'].map(
    (key) => `baselinePlan.blocks[].items[].${key}`,
  ),
  'due',
  ...['itemId', 'type', 'topic', 'difficulty', 'level', 'weak', 'daysOverdue'].map(
    (key) => `due[].${key}`,
  ),
  'newQueueHead',
  ...['itemId', 'type', 'topic', 'difficulty', 'estMinutes'].map((key) => `newQueueHead[].${key}`),
  'deepDives',
  'deepDives[].itemId',
  'deepDives[].about',
  'weakTopics',
  'customItems',
  ...['itemId', 'type', 'topic', 'status', 'srsStatus', 'createdOn'].map(
    (key) => `customItems[].${key}`,
  ),
  'overrides',
  ...['trackId', 'key', 'kind', 'until', 'studyDaysLeft'].map((key) => `overrides[].${key}`),
  'recent',
  'recent.days',
  ...['localDay', 'completed', 'minutesByTrack', 'minutesByTrack.*'].map(
    (key) => `recent.days[].${key}`,
  ),
  'recent.results',
  ...['itemId', 'result', 'mode', 'localDay'].map((key) => `recent.results[].${key}`),
  'constraints',
  ...[
    'allowedNewItems',
    'allowedReviewItems',
    'maxPlannedMinutesRule',
    'customItems',
    'customItems.remainingToday',
    'customItems.remainingTotal',
    'overrides',
    'overrides.remainingActive',
    'overrides.remainingActive.*',
    'rationaleMaxChars',
  ].map((key) => `constraints.${key}`),
  'untrusted',
  'untrusted.notes',
  ...['localDay', 'blockKind', 'text'].map((key) => `untrusted.notes[].${key}`),
])

/** A learner with a bit of everything: due and Weak problems, a deep-dive, a custom card, a
 *  checked-in baseline plan today, results, activity and notes. */
function fullLearner(share = true) {
  const core = dsaCore()
  const [a, b, c, d] = core as [string, string, string, string]
  setDay({
    userItems: [
      customRow(),
      customRow({ itemId: customItemId(BOT_REF, 'old-card'), status: 'hidden' }),
    ],
    items: statesOf(
      itemState(a, { weak: true, status: 'weak', dueOn: '2026-10-04', level: 1 }),
      itemState(b, { weak: true, status: 'weak', dueOn: '2026-10-06', level: 2 }),
      itemState(c, { dueOn: '2026-10-01', level: 2 }),
      itemState(d, { status: 'mastered', level: 4 }),
      { ...itemState(core[4]!), itemId: CARD_ID, itemType: 'flashcard', topicId: 'arrays-hashing' },
    ),
  })
  state.resolution = {
    kind: 'today',
    read: { row: planRow(), plan: storedPlan() },
  } satisfies Resolution
  setDb({
    share,
    tables: {
      plan_block_state: [
        noteRow(TODAY, 'Hôm nay <b>khó</b> quá, xem https://evil.example', 1),
        { ...noteRow(addDays(TODAY, -20), 'quá cũ', 2), plan_id: OLD_PLAN_ID },
      ],
      daily_activity: [
        {
          user_id: USER_ID,
          local_day: addDays(TODAY, -1),
          completed: true,
          items_done: 3,
          minutes_by_track: { dsa: 55 },
          version: 1,
          rules_version: 3,
        },
      ],
      events: [
        event('item.result', '2026-10-05', {
          item_id: a,
          payload: { result: 'failed', mode: 'redo' },
        }),
        event('item.result', '2026-10-04', { item_id: b, payload: { result: 'hint' } }),
        event('block.checked_in', '2026-10-05', {
          block_id: `2026-10-05:dsa:new:1`,
          payload: { status: 'done', minutes: 30, note: 'riêng tư' },
        }),
      ],
    },
  })
}

describe('buildContext (§6.4.2)', () => {
  it('holds exactly the allow-listed keys, recursively', async () => {
    fullLearner()
    const context = await buildContext(RUN_USER, RUN_AT)
    const paths = keyPaths(context)
    expect([...paths].filter((path) => !ALLOWED_PATHS.has(path))).toEqual([])
    expect(Object.keys(context).toSorted()).toEqual(
      [
        'targetDate',
        'gate',
        'existingPlan',
        'tracks',
        'baselinePlan',
        'due',
        'newQueueHead',
        'deepDives',
        'weakTopics',
        'customItems',
        'overrides',
        'recent',
        'constraints',
        'untrusted',
      ].toSorted(),
    )
    // The contract parses it (the route sends nothing else).
    expect(contextResponse.safeParse(context).success).toBe(true)
  })

  it('carries no UUID, no user id, no name or avatar, and never a check-in event’s note', async () => {
    fullLearner()
    const json = JSON.stringify(await buildContext(RUN_USER, RUN_AT))
    expect(json).not.toMatch(UUID)
    expect(json).not.toContain(USER_ID)
    expect(json).not.toContain('Bí Mật')
    expect(json).not.toContain('avatars.example')
    expect(json).not.toContain('riêng tư')
    expect(json).not.toContain(RUN_USER.userRef)
  })

  it('fills the day: targetDate, tracks, the baseline plan, due, heads, custom items, recent', async () => {
    fullLearner()
    const context = await buildContext(RUN_USER, RUN_AT)
    const [a, b, c] = dsaCore() as [string, string, string]
    expect(context.targetDate).toBe(TODAY)
    expect(context.gate).toBe('open')
    expect(context.tracks.map((track) => track.trackId)).toEqual(['dsa', 'english'])
    const dsa = context.tracks[0]!
    expect(dsa).toMatchObject({ roadmapVariant: '8w', budgetMinutes: 60, throttleReason: null })
    // 2026-10-06 is a Tuesday: the weekday template, no `fromWeek` left in it.
    expect(dsa.templateToday).toEqual([{ kind: 'review', maxMinutes: 15 }, { kind: 'new' }])
    expect(dsa.upcomingTopics.length).toBeGreaterThan(0)
    expect(dsa.upcomingTopics).not.toContain(BASE.items[a]!.topicId)
    // English core cards live in decks: a reorder moves nothing (6.6b review).
    expect(context.tracks[1]!.upcomingTopics).toEqual([])
    expect(context.baselinePlan.blocks.length).toBeGreaterThan(0)
    // Weak first (the more overdue first), then the other due item.
    expect(context.due.map((entry) => entry.itemId)).toEqual([a, b, c])
    expect(context.due[0]).toEqual({
      itemId: a,
      type: 'problem',
      topic: BASE.items[a]!.topicId,
      difficulty: BASE.items[a]!.difficulty,
      level: 1,
      weak: true,
      daysOverdue: 2,
    })
    expect(context.constraints.allowedReviewItems.slice(0, 3)).toEqual([a, b, c])
    expect(context.constraints.allowedReviewItems).toContain(CARD_ID)
    expect(context.constraints.allowedReviewItems).not.toContain(dsaCore()[3])
    expect(context.customItems).toEqual([
      {
        itemId: CARD_ID,
        type: 'flashcard',
        topic: 'arrays-hashing',
        status: 'active',
        srsStatus: 'ok',
        createdOn: '2026-10-01',
      },
      {
        itemId: customItemId(BOT_REF, 'old-card'),
        type: 'flashcard',
        topic: 'arrays-hashing',
        status: 'hidden',
        srsStatus: null,
        createdOn: '2026-10-01',
      },
    ])
    expect(context.overrides).toEqual([])
    expect(context.recent.days).toHaveLength(14)
    expect(context.recent.days[0]).toEqual({
      localDay: TODAY,
      completed: false,
      minutesByTrack: {},
    })
    expect(context.recent.days[1]).toEqual({
      localDay: '2026-10-05',
      completed: true,
      minutesByTrack: { dsa: 55 },
    })
    expect(context.recent.results).toEqual([
      { itemId: a, result: 'failed', mode: 'redo', localDay: '2026-10-05' },
      { itemId: b, result: 'hint', mode: null, localDay: '2026-10-04' },
    ])
    expect(context.constraints).toMatchObject({
      maxPlannedMinutesRule: 'budget, or budget + the single largest item',
      customItems: { remainingToday: 10, remainingTotal: 199 },
      overrides: { remainingActive: { dsa: 3, english: 3 } },
      rationaleMaxChars: 280,
    })
  })

  it('the baseline plan is exactly buildPlan of the day', async () => {
    fullLearner()
    const { buildPlan } = await import('@/lib/domain/plan/buildPlan')
    const u = await loadUserDay(USER_ID, RUN_AT)
    const context = await buildContext(RUN_USER, RUN_AT)
    expect(context.baselinePlan.blocks).toEqual(buildPlan(u.context).blocks)
  })

  it('counts today’s custom items against the per-day quota', async () => {
    fullLearner()
    state.db.tables.events!.push(
      event('user_item.created', TODAY),
      event('user_item.created', TODAY),
      event('user_item.created', '2026-10-05'),
    )
    const context = await buildContext(RUN_USER, RUN_AT)
    expect(context.constraints.customItems.remainingToday).toBe(8)
  })

  it('an existing plan of today → existingPlan with its checked-in blocks', async () => {
    fullLearner()
    state.db.tables.plan_block_state!.push(noteRow(TODAY, null, 2, 'review'))
    const context = await buildContext(RUN_USER, RUN_AT)
    expect(context.existingPlan).toEqual({ source: 'baseline', checkedInBlocks: 2 })
  })

  it('no plan of today → existingPlan null', async () => {
    const context = await buildContext(RUN_USER, RUN_AT)
    expect(context.existingPlan).toBeNull()
    expect(context.gate).toBe('open')
  })

  it('an AI plan of today reads as source ai', async () => {
    state.resolution = {
      kind: 'today',
      read: { row: planRow({ source: 'ai' }), plan: storedPlan({ source: 'ai' }) },
    }
    const context = await buildContext(RUN_USER, RUN_AT)
    expect(context.existingPlan).toEqual({ source: 'ai', checkedInBlocks: 0 })
  })

  it('a paused learner → gate closed (decision 9)', async () => {
    const plan = storedPlan({ planDate: '2026-10-01' })
    state.resolution = {
      kind: 'paused',
      plan,
      unfinished: [],
      blocks: {},
      daysSince: 5,
      offerResume: true,
    } satisfies Resolution
    const context = await buildContext(RUN_USER, RUN_AT)
    expect(context.gate).toBe('closed')
    expect(context.existingPlan).toBeNull()
  })

  it('a learner who resumed today → gate closed (decision 9)', async () => {
    state.resolution = {
      kind: 'resumed',
      plan: storedPlan({ planDate: '2026-10-01' }),
      blocks: {},
    } satisfies Resolution
    const context = await buildContext(RUN_USER, RUN_AT)
    expect(context.gate).toBe('closed')
  })

  it('targetDate is a Los Angeles learner’s own day while Vietnam is on the next date', async () => {
    setDay({ versions: [LOS_ANGELES] })
    const context = await buildContext(RUN_USER, RUN_AT)
    expect(context.targetDate).toBe('2026-10-05')
    expect(state.loadedAt).toBe(RUN_AT)
    // The same instant for a Vietnam learner is already the next day.
    setDay({ versions: [VIETNAM] })
    expect((await buildContext(RUN_USER, RUN_AT)).targetDate).toBe('2026-10-06')
  })

  it('at most 50 due items, in the due queue’s order', async () => {
    const core = dsaCore().slice(0, 60)
    expect(core).toHaveLength(60)
    setDay({
      items: statesOf(
        ...core.map((itemId, index) =>
          itemState(itemId, {
            dueOn: addDays(TODAY, -(index % 9)),
            weak: index % 7 === 0,
            status: index % 7 === 0 ? 'weak' : 'ok',
          }),
        ),
      ),
    })
    const context = await buildContext(RUN_USER, RUN_AT)
    expect(context.due).toHaveLength(50)
    const weak = context.due.map((entry) => entry.weak)
    expect(weak.indexOf(false)).toBeGreaterThan(weak.lastIndexOf(true))
    // Every due item may be reviewed, the 10 cut from `due` too.
    expect(context.constraints.allowedReviewItems.slice(0, 60).toSorted()).toEqual(core.toSorted())
  })

  it('at most 10 new-queue items per track, with their new minutes', async () => {
    const context = await buildContext(RUN_USER, RUN_AT)
    for (const trackId of ['dsa', 'english']) {
      const head = context.newQueueHead.filter(
        (entry) => BASE.items[entry.itemId]?.trackId === trackId,
      )
      expect(head.length).toBeGreaterThan(0)
      expect(head.length).toBeLessThanOrEqual(10)
      for (const entry of head) expect(entry.estMinutes).toBe(BASE.items[entry.itemId]!.minutes.new)
    }
    expect(context.newQueueHead.length).toBeLessThanOrEqual(20)
  })

  it('lists active deep-dives the learner has not completed', async () => {
    const deepDive = Object.values(BASE.items).find(
      (item) => item.about !== null && item.status === 'active',
    )
    if (deepDive === undefined) return
    const context = await buildContext(RUN_USER, RUN_AT)
    expect(context.deepDives).toContainEqual({ itemId: deepDive.id, about: deepDive.about })
    setDay({ items: statesOf(itemState(deepDive.id)) })
    expect((await buildContext(RUN_USER, RUN_AT)).deepDives).not.toContainEqual(
      expect.objectContaining({ itemId: deepDive.id }),
    )
  })

  describe('notes (decision 32)', () => {
    it('are absent when the learner does not share them', async () => {
      fullLearner(false)
      const context = await buildContext(RUN_USER, RUN_AT)
      expect(context.untrusted).toBeUndefined()
      expect(JSON.stringify(context)).not.toContain('khó')
    })

    it('are at most 5 sanitised notes of the last 14 days, newest first, when shared', async () => {
      fullLearner(true)
      state.db.tables.plan_block_state = [
        noteRow(TODAY, '<script>x</script>', 1),
        ...Array.from({ length: 6 }, (_, index) =>
          noteRow(addDays(TODAY, -index), `ghi chú ${index} [link](https://evil.example)`, 2),
        ),
        noteRow(addDays(TODAY, -13), 'vẫn trong 14 ngày', 3),
        noteRow(addDays(TODAY, -14), 'quá 14 ngày', 3),
      ]
      const context = await buildContext(RUN_USER, RUN_AT)
      const notes = context.untrusted!.notes
      expect(notes).toHaveLength(5)
      expect(notes.map((entry) => entry.text)).toEqual([
        'ghi chú 0 link',
        'ghi chú 1 link',
        'ghi chú 2 link',
        'ghi chú 3 link',
        'ghi chú 4 link',
      ])
      expect(notes[0]).toEqual({ localDay: TODAY, blockKind: 'new', text: 'ghi chú 0 link' })
      expect(JSON.stringify(notes)).not.toMatch(/https?:|<|>/)
    })

    it('keeps an old note out even when fewer than 5 are recent', async () => {
      fullLearner(true)
      const notes = (await buildContext(RUN_USER, RUN_AT)).untrusted!.notes
      expect(notes).toEqual([{ localDay: TODAY, blockKind: 'new', text: 'Hôm nay khó quá, xem' }])
    })
  })
})

describe('allowanceOf (6.5a’s AiPlanAllowance)', () => {
  it('a throttled English track (newPerDay 4) allows at most 4 new cards', async () => {
    const cards = englishCards()
    const due = cards.slice(0, 45)
    setDay({
      items: statesOf(...due.map((itemId) => itemState(itemId, { dueOn: '2026-10-05' }))),
    })
    const u = await loadUserDay(USER_ID, RUN_AT)
    expect(u.baseline.tracks.english).toMatchObject({ newPerDay: 4, throttled: true })
    const allowance = allowanceOf(u, [])
    const newCards = [...allowance.allowedNew].filter(
      (itemId) => BASE.items[itemId]?.trackId === 'english',
    )
    expect(newCards.length).toBeGreaterThan(0)
    expect(
      newCards.filter((itemId) => BASE.items[itemId]!.srs !== null).length,
    ).toBeLessThanOrEqual(4)
    // The context says why, and offers the same cut list.
    const context = await buildContext(RUN_USER, RUN_AT)
    expect(context.tracks[1]).toMatchObject({
      effectiveNewPerDay: 4,
      throttleReason: 'due_above_40',
    })
    expect(context.constraints.allowedNewItems).toEqual([...allowance.allowedNew])
    const englishHead = context.newQueueHead.filter(
      (entry) => BASE.items[entry.itemId]?.trackId === 'english',
    )
    expect(englishHead).toHaveLength(10)
  })

  it('a track at 0 new items a day allows none of its new cards', async () => {
    const cards = englishCards()
    setDay({
      items: statesOf(
        ...cards.slice(0, 65).map((itemId) => itemState(itemId, { dueOn: '2026-10-05' })),
      ),
    })
    const allowance = allowanceOf(await loadUserDay(USER_ID, RUN_AT), [])
    expect(
      [...allowance.allowedNew].filter(
        (itemId) => BASE.items[itemId]?.trackId === 'english' && BASE.items[itemId]!.srs !== null,
      ),
    ).toEqual([])
  })

  it('a track that has not started yet is absent', async () => {
    setDay({ enrollments: [enrollment('dsa'), enrollment('english', { startDate: '2026-10-20' })] })
    const u = await loadUserDay(USER_ID, RUN_AT)
    const allowance = allowanceOf(u, [])
    expect([...allowance.activeTrackIds]).toEqual(['dsa'])
    expect(Object.keys(allowance.budgets)).toEqual(['dsa'])
    expect([...allowance.allowedNew].every((itemId) => BASE.items[itemId]?.trackId === 'dsa')).toBe(
      true,
    )
    const context = await buildContext(RUN_USER, RUN_AT)
    expect(context.tracks.map((track) => track.trackId)).toEqual(['dsa'])
    expect(Object.keys(context.constraints.overrides.remainingActive)).toEqual(['dsa'])
  })

  it('a paused track is absent', async () => {
    setDay({ enrollments: [enrollment('dsa', { status: 'paused' }), enrollment('english')] })
    const allowance = allowanceOf(await loadUserDay(USER_ID, RUN_AT), [])
    expect([...allowance.activeTrackIds]).toEqual(['english'])
  })

  it('a track in an extra week allows no new item (decision 37)', async () => {
    const core = dsaCore()
    const topicId = BASE.items[core[0]!]!.topicId!
    setDay({
      items: statesOf(
        itemState(core[0]!, { weak: true, status: 'weak', dueOn: '2026-10-10' }),
        itemState(core[1]!, { dueOn: '2026-10-10' }),
      ),
    })
    state.overrides = [
      {
        trackId: 'dsa',
        key: 'ah-extra',
        kind: 'extra_week',
        params: { topicId, studyDays: 3 },
        startLocalDay: '2026-10-05',
        usedDays: 0,
      } satisfies RoadmapOverride,
    ]
    const u = await loadUserDay(USER_ID, RUN_AT)
    expect(u.baseline.tracks.dsa?.extraWeek).toBe('ah-extra')
    const allowance = allowanceOf(u, [])
    expect(
      [...allowance.allowedNew].filter((itemId) => BASE.items[itemId]?.trackId === 'dsa'),
    ).toEqual([])
    expect([...allowance.allowedNew].length).toBeGreaterThan(0) // English still has its own
  })

  it('carries the day, budgets, reviews, own active custom items and open deep-dives', async () => {
    fullLearner()
    const u = await loadUserDay(USER_ID, RUN_AT)
    const [a, , , d] = dsaCore() as [string, string, string, string]
    const allowance = allowanceOf(u, [
      CARD_ID,
      customItemId(BOT_REF, 'old-card'),
      'user:fedcba9876543210:x',
    ])
    expect(allowance.today).toBe(TODAY)
    expect(allowance.catalog).toBe(u.context.catalog)
    expect(allowance.budgets).toEqual({ dsa: 60, english: 25 })
    expect(allowance.allowedReview.has(a)).toBe(true)
    expect(allowance.allowedReview.has(d)).toBe(false) // mastered
    // Only the learner's active custom items count, whatever the caller passes.
    expect([...allowance.ownCustomItems]).toEqual([CARD_ID])
    expect(activeCustomItemIds(u)).toEqual([CARD_ID])
    for (const itemId of allowance.openDeepDives) {
      expect(BASE.items[itemId]).toMatchObject({ status: 'active' })
      expect(BASE.items[itemId]!.about).not.toBeNull()
    }
    // The allowance never admits a new item the context does not list.
    const context = await buildContext(RUN_USER, RUN_AT)
    expect([...allowance.allowedNew]).toEqual(context.constraints.allowedNewItems)
    expect([...allowance.allowedReview]).toEqual(context.constraints.allowedReviewItems)
  })
})
