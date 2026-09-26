import { describe, expect, it, vi } from 'vitest'
import { enrollment, itemState } from '@/lib/domain/plan/__tests__/fixtures'
import { scheduleSkippedDays } from '@/lib/domain/stats/streak'
import type { DailyActivity } from '@/lib/domain/state'
import type { ScheduleVersion } from '@/lib/domain/time/localDay'
import type { TodayState } from '@/lib/plans/today'
import {
  block,
  blockState,
  DSA_TITLE,
  ENGLISH_TITLE,
  OLD_PLAN_ID,
  PLAN_ID,
  REQUEST_ID,
  SNAPSHOT,
  storedPlan,
  TODAY,
  todayData,
  TRACK_MANIFESTS,
} from './__tests__/fixtures'

vi.mock('@/lib/content/catalog', () => ({
  getTrack: (id: string) => TRACK_MANIFESTS[id] ?? null,
}))

const { buildTodayPage } = await import('./view-model')

const NO_ACTIVITY: Readonly<Record<string, DailyActivity>> = {}

const planState = (plan = storedPlan(), blocks = {}): TodayState => ({ kind: 'plan', plan, blocks })

/** The href's path and its `block` / `mode` parameters. */
function parsed(href: string) {
  const url = new URL(href, 'http://localhost')
  return {
    path: url.pathname,
    block: url.searchParams.get('block'),
    mode: url.searchParams.get('mode'),
  }
}

describe('buildTodayPage — blocks', () => {
  const blocks = [
    block(`${TODAY}:dsa:review:1`, {
      kind: 'review',
      trackId: 'dsa',
      estMinutes: 10,
      items: [
        { itemId: 'dsa:p1', mode: 'recall', minutes: 5 },
        { itemId: 'dsa:p2', mode: 'redo', minutes: 5 },
      ],
    }),
    block(`${TODAY}:dsa:new:1`, {
      kind: 'new',
      trackId: 'dsa',
      estMinutes: 50,
      items: [{ itemId: 'dsa:p4', mode: 'new', minutes: 50, overBudget: true }],
    }),
    block(`${TODAY}:english:new:1`, {
      kind: 'new',
      trackId: 'english',
      estMinutes: 3,
      items: [
        { itemId: 'english:e1', mode: 'new', minutes: 1.5 },
        { itemId: 'english:explaining-code:dsa:p1', mode: 'new', minutes: 1.5 },
      ],
    }),
    block(`${TODAY}:dsa:recap:1`, { kind: 'recap', trackId: 'dsa', recapWeek: 1 }),
    block(`${TODAY}:dsa:recap:2`, { kind: 'recap', trackId: 'dsa', recapWeek: null }),
    block(`${TODAY}:english:practice:1`, {
      kind: 'practice',
      trackId: 'english',
      itemType: 'exercise',
      estMinutes: 5,
      items: [{ itemId: 'english:ex-w1-a', mode: 'new', minutes: 5 }],
    }),
    block(`${TODAY}:english:practice:2`, {
      kind: 'practice',
      trackId: 'english',
      tag: 'shadowing',
      estMinutes: 3,
      shadowing: ['english:e1', 'english:e2'],
    }),
    block(`${TODAY}:dsa:extra:1`, { kind: 'extra', trackId: 'dsa' }),
  ]
  const page = buildTodayPage(
    todayData(planState(storedPlan({ blocks }), {})),
    NO_ACTIVITY,
    REQUEST_ID,
  )

  it('keeps the plan order, one view per block, with its title, accent and minutes', () => {
    expect(page.blocks.map((view) => view.block.id)).toEqual(blocks.map((b) => b.id))
    expect(page.blocks.map((view) => [view.trackTitle, view.accent])).toEqual([
      [DSA_TITLE, 'track-1'],
      [DSA_TITLE, 'track-1'],
      [ENGLISH_TITLE, 'track-2'],
      [DSA_TITLE, 'track-1'],
      [DSA_TITLE, 'track-1'],
      [ENGLISH_TITLE, 'track-2'],
      [ENGLISH_TITLE, 'track-2'],
      [DSA_TITLE, 'track-1'],
    ])
    expect(page.blocks.map((view) => view.minutes)).toEqual([10, 50, 3, 10, 10, 5, 3, 10])
  })

  it('labels each kind: review, new, a recap week, filler recap, practice by type or tag, extra', () => {
    expect(page.blocks.map((view) => view.kindLabel)).toEqual([
      'Ôn tập',
      'Bài mới',
      'Bài mới',
      'Ôn tuần 1',
      'Ôn lại',
      'Bài tập',
      'Shadowing',
      'Học thêm',
    ])
  })

  it('labels a mock interview, a weekend task, and an unknown practice tag', () => {
    const practice = (tag: string) =>
      block(`${TODAY}:dsa:practice:${tag}`, { kind: 'practice', trackId: 'dsa', tag })
    const labels = buildTodayPage(
      todayData(
        planState(
          storedPlan({
            blocks: [practice('mock-interview'), practice('weekend-task'), practice('toString')],
          }),
        ),
      ),
      NO_ACTIVITY,
      REQUEST_ID,
    ).blocks.map((view) => view.kindLabel)
    expect(labels).toEqual(['Mock interview', 'Nhiệm vụ cuối tuần', 'Luyện tập'])
  })

  it('links every item to its page with ?block= and ?mode= (derived card IDs encoded)', () => {
    const review = page.blocks[0]!
    expect(review.items.map((item) => [item.itemId, item.mode])).toEqual([
      ['dsa:p1', 'recall'],
      ['dsa:p2', 'redo'],
    ])
    expect(parsed(review.items[0]!.href)).toEqual({
      path: '/t/dsa/items/p1',
      block: `${TODAY}:dsa:review:1`,
      mode: 'recall',
    })
    const english = page.blocks[2]!
    expect(english.items[1]!.href.startsWith('/t/english/items/explaining-code%3Adsa%3Ap1?')).toBe(
      true,
    )
    expect(parsed(english.items[1]!.href)).toMatchObject({
      block: `${TODAY}:english:new:1`,
      mode: 'new',
    })
    // A shadowing block has cards, not items.
    expect(page.blocks[6]!.items).toEqual([])
  })

  it('flags a new item marked overBudget, and nothing else in these blocks', () => {
    expect(page.blocks.map((view) => view.overBudget)).toEqual([
      false,
      true,
      false,
      false,
      false,
      false,
      false,
      false,
    ])
  })

  it('flags a practice block longer than the track budget (M4-R10): 45 min on 30, not 15 on 30', () => {
    const practice = (id: string, tag: string, minutes: number) =>
      block(id, { kind: 'practice', trackId: 'dsa', tag, estMinutes: minutes })
    const views = buildTodayPage(
      todayData(
        planState(
          storedPlan({
            blocks: [
              practice(`${TODAY}:dsa:practice:1`, 'mock-interview', 45),
              practice(`${TODAY}:dsa:practice:2`, 'weekend-task', 15),
              practice(`${TODAY}:dsa:practice:3`, 'weekend-task', 30),
            ],
          }),
        ),
        { enrollments: [enrollment('dsa', { budgetMinutes: 30 }), enrollment('english')] },
      ),
      NO_ACTIVITY,
      REQUEST_ID,
    ).blocks
    expect(views.map((view) => view.overBudget)).toEqual([true, false, false])
  })

  it("carries each block's check-in, null without one", () => {
    const done = blockState(PLAN_ID, `${TODAY}:dsa:review:1`, { status: 'partial', minutes: 7 })
    const views = buildTodayPage(
      todayData(planState(storedPlan({ blocks }), { [`${PLAN_ID}/${TODAY}:dsa:review:1`]: done })),
      NO_ACTIVITY,
      REQUEST_ID,
    ).blocks
    expect(views[0]!.checkIn).toEqual(done)
    expect(views.slice(1).every((view) => view.checkIn === null)).toBe(true)
  })

  it('shows the resumed plan with its check-ins, and the paused plan’s unfinished blocks only', () => {
    const yesterday = '2026-09-27'
    const oldBlocks = [
      block(`${yesterday}:dsa:review:1`, { kind: 'review', trackId: 'dsa' }),
      block(`${yesterday}:dsa:new:1`, { kind: 'new', trackId: 'dsa' }),
    ]
    const old = storedPlan({ id: OLD_PLAN_ID, planDate: yesterday, blocks: oldBlocks })
    const checked = {
      [`${OLD_PLAN_ID}/${yesterday}:dsa:review:1`]: blockState(
        OLD_PLAN_ID,
        `${yesterday}:dsa:review:1`,
      ),
    }
    const resumed = buildTodayPage(
      todayData({ kind: 'resumed', plan: old, blocks: checked }),
      NO_ACTIVITY,
      REQUEST_ID,
    )
    expect(resumed.blocks.map((view) => [view.block.id, view.checkIn?.status ?? null])).toEqual([
      [`${yesterday}:dsa:review:1`, 'done'],
      [`${yesterday}:dsa:new:1`, null],
    ])

    const paused = buildTodayPage(
      todayData({
        kind: 'paused',
        plan: old,
        unfinished: [oldBlocks[1]!],
        blocks: {},
        daysSince: 3,
        offerResume: true,
      }),
      NO_ACTIVITY,
      REQUEST_ID,
    )
    expect(paused.blocks.map((view) => view.block.id)).toEqual([`${yesterday}:dsa:new:1`])
  })

  it.each([
    { kind: 'notStarted', startDate: '2026-10-03' },
    { kind: 'noTracks' },
    { kind: 'unreadable' },
  ] satisfies TodayState[])('has no blocks in the $kind state', (state) => {
    expect(buildTodayPage(todayData(state), NO_ACTIVITY, REQUEST_ID).blocks).toEqual([])
  })
})

describe('buildTodayPage — tracks', () => {
  const items = {
    'dsa:p1': itemState('dsa:p1', '2026-09-20', { dueOn: '2026-09-27' }),
    'dsa:p2': itemState('dsa:p2', '2026-09-20', { dueOn: '2026-10-11' }),
    'dsa:p8': itemState('dsa:p8', '2026-09-20', { dueOn: '2026-09-27' }),
    'english:e1': itemState('english:e1', '2026-09-27', { dueOn: TODAY }),
    'english:e2': itemState('english:e2', '2026-09-27', { dueOn: TODAY, status: 'mastered' }),
  }
  const tracks = {
    dsa: SNAPSHOT,
    english: { ...SNAPSHOT, variant: '10w', dueCount: 52, newPerDay: 0, throttled: true },
  }

  it('gives each active track its week, weeks and progress from introduced active core items', () => {
    const page = buildTodayPage(
      todayData(planState(storedPlan({ tracks })), { items }),
      NO_ACTIVITY,
      REQUEST_ID,
    )
    expect(page.tracks.map((track) => track.trackId)).toEqual(['dsa', 'english'])
    const [dsa, english] = page.tracks
    // DSA 8w (fixture): W1 p1 p2 p3, W2 p5 p6 p8 (retired) — 5 active core items, 2 introduced
    // (p8 is retired: it counts nowhere).
    expect(dsa).toMatchObject({
      title: DSA_TITLE,
      accent: 'track-1',
      week: 1,
      weeks: 2,
      progress: 2 / 5,
    })
    // English 10w: W1 core cards e1–e4, W2 e5 e6 — 2 of 6 introduced (a mastered card counts).
    expect(english).toMatchObject({ title: ENGLISH_TITLE, week: 1, weeks: 2, progress: 2 / 6 })
  })

  it('counts the due reviews of active items now (not mastered, not retired)', () => {
    const page = buildTodayPage(
      todayData(planState(storedPlan({ tracks })), { items }),
      NO_ACTIVITY,
      REQUEST_ID,
    )
    expect(page.tracks.map((track) => track.dueCount)).toEqual([1, 1])
  })

  it('says why new cards are fewer only when the snapshot is throttled, with its dueCount', () => {
    const page = buildTodayPage(
      todayData(planState(storedPlan({ tracks })), { items }),
      NO_ACTIVITY,
      REQUEST_ID,
    )
    expect(page.tracks.map((track) => track.throttleMessage)).toEqual([
      null,
      'Đang có 52 thẻ cần ôn — tạm giảm thẻ mới.',
    ])
  })

  it('reads the throttle of the resumed plan too, but never of a paused (stale) one', () => {
    const plan = storedPlan({ tracks, planDate: '2026-09-27' })
    const resumed = buildTodayPage(
      todayData({ kind: 'resumed', plan, blocks: {} }),
      NO_ACTIVITY,
      REQUEST_ID,
    )
    expect(resumed.tracks[1]!.throttleMessage).not.toBeNull()
    const paused = buildTodayPage(
      todayData({
        kind: 'paused',
        plan,
        unfinished: [],
        blocks: {},
        daysSince: 1,
        offerResume: false,
      }),
      NO_ACTIVITY,
      REQUEST_ID,
    )
    expect(paused.tracks.map((track) => track.throttleMessage)).toEqual([null, null])
  })

  it('leaves out paused and removed tracks; a track without its roadmap is week 1 of 0, 0 %', () => {
    const page = buildTodayPage(
      todayData(planState(), {
        enrollments: [
          enrollment('dsa', { status: 'paused' }),
          enrollment('english', { variant: '6w' }),
        ],
      }),
      NO_ACTIVITY,
      REQUEST_ID,
    )
    expect(page.tracks).toEqual([
      {
        trackId: 'english',
        title: ENGLISH_TITLE,
        accent: 'track-2',
        week: 1,
        weeks: 0,
        progress: 0,
        dueCount: 0,
        throttleMessage: null,
      },
    ])
  })
})

describe('buildTodayPage — streak', () => {
  const day = (localDay: string, completed = true): DailyActivity => ({
    localDay,
    minutesByTrack: { dsa: 20 },
    itemsDone: 1,
    completed,
  })
  const activity = (...days: DailyActivity[]) =>
    Object.fromEntries(days.map((entry) => [entry.localDay, entry]))

  it('is 0 without daily_activity (a new learner)', () => {
    expect(buildTodayPage(todayData(planState()), NO_ACTIVITY, REQUEST_ID).streak).toBe(0)
  })

  it('counts completed days ending today, or yesterday while today is not completed', () => {
    const rows = activity(day('2026-09-26'), day('2026-09-27'), day('2026-09-25', false))
    expect(buildTodayPage(todayData(planState()), rows, REQUEST_ID).streak).toBe(2)
    const withToday = { ...rows, [TODAY]: day(TODAY) }
    expect(buildTodayPage(todayData(planState()), withToday, REQUEST_ID).streak).toBe(3)
  })

  it('passes over a single date a schedule change skipped (§5.7, §5.9)', () => {
    // Los Angeles → Kiritimati (UTC+14, day start 00:00) at LA's 2026-09-25 04:00: 09-25 never
    // exists as a local day.
    const versions: ScheduleVersion[] = [
      {
        timezone: 'America/Los_Angeles',
        dayStartsAt: '04:00',
        effectiveAt: '2026-01-01T00:00:00.000Z',
      },
      {
        timezone: 'Pacific/Kiritimati',
        dayStartsAt: '00:00',
        effectiveAt: '2026-09-25T11:00:00.000Z',
      },
    ]
    expect([...scheduleSkippedDays(versions)]).toEqual(['2026-09-25'])
    const rows = activity(
      day('2026-09-27'),
      day('2026-09-26'),
      day('2026-09-24'),
      day('2026-09-23'),
    )
    expect(buildTodayPage(todayData(planState(), { versions }), rows, REQUEST_ID).streak).toBe(4)
    // Without the schedule change the missing 09-25 breaks it.
    expect(buildTodayPage(todayData(planState()), rows, REQUEST_ID).streak).toBe(2)
  })
})

describe('buildTodayPage — weak topics', () => {
  it('lists topics with ≥ 2 Weak items of active tracks only, most items first', () => {
    const weak = (id: string) => itemState(id, '2026-09-20', { status: 'weak', weak: true })
    const items = Object.fromEntries(
      ['dsa:p1', 'dsa:p2', 'dsa:p3', 'dsa:p5', 'dsa:p6', 'english:e1', 'english:e2'].map((id) => [
        id,
        weak(id),
      ]),
    )
    const page = buildTodayPage(
      todayData(planState(), {
        items: { ...items, 'dsa:p4': itemState('dsa:p4', '2026-09-20') },
        enrollments: [enrollment('dsa'), enrollment('english', { status: 'paused' })],
      }),
      NO_ACTIVITY,
      REQUEST_ID,
    )
    expect(page.weakTopics).toEqual([
      { trackId: 'dsa', title: 'Arrays & Hashing', trackTitle: DSA_TITLE, count: 3 },
      { trackId: 'dsa', title: 'Two Pointers', trackTitle: DSA_TITLE, count: 2 },
    ])
  })
})

describe('buildTodayPage — seen, request', () => {
  it('marks today’s plan seen only in the plan state', () => {
    const plan = storedPlan()
    expect(buildTodayPage(todayData(planState(plan)), NO_ACTIVITY, REQUEST_ID).markSeenPlanId).toBe(
      PLAN_ID,
    )
    const others: TodayState[] = [
      { kind: 'resumed', plan, blocks: {} },
      { kind: 'paused', plan, unfinished: [], blocks: {}, daysSince: 3, offerResume: true },
      { kind: 'notStarted', startDate: '2026-10-03' },
      { kind: 'noTracks' },
      { kind: 'unreadable' },
    ]
    for (const state of others) {
      expect(buildTodayPage(todayData(state), NO_ACTIVITY, REQUEST_ID).markSeenPlanId).toBeNull()
    }
  })

  it('passes the data and the per-render request id through', () => {
    const data = todayData(planState())
    const page = buildTodayPage(data, NO_ACTIVITY, REQUEST_ID)
    expect(page.data).toBe(data)
    expect(page.requestId).toBe(REQUEST_ID)
  })
})
