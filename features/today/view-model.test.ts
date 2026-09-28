import { describe, expect, it, vi } from 'vitest'
import { reviewQueue } from '@/features/review'
import { trackProgressOf } from '@/lib/domain/plan/trackProgress'
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

  it('gives each block its "Sửa" link, /today?block=<id>, and its check-in minutes (5.2b)', () => {
    expect(page.blocks.map((view) => view.editHref)).toEqual(
      blocks.map((b) => `/today?block=${encodeURIComponent(b.id)}`),
    )
    expect(new URL(page.blocks[0]!.editHref, 'http://localhost').searchParams.get('block')).toBe(
      `${TODAY}:dsa:review:1`,
    )
    // checkInMinutes: Math.ceil(estMinutes) — an English block of 3 × 1.5 minutes pre-fills 3,
    // a 19.5-minute block 20 (decision 34 of M4).
    expect(page.blocks.map((view) => view.defaultMinutes)).toEqual([10, 50, 3, 10, 10, 5, 3, 10])
    const half = buildTodayPage(
      todayData(
        planState(
          storedPlan({
            blocks: [
              block(`${TODAY}:dsa:new:1`, { kind: 'new', trackId: 'dsa', estMinutes: 19.5 }),
            ],
          }),
        ),
      ),
      NO_ACTIVITY,
      REQUEST_ID,
    )
    expect(half.blocks[0]!.defaultMinutes).toBe(20)
  })

  it("pre-fills the block less its items skipped for the plan (M5-R39 #3): the one-tap's minutes", () => {
    const skipped = itemState('english:e1', TODAY, {
      status: 'skipped',
      level: 0,
      lastResult: null,
      lastResultOn: null,
    })
    const reviewed = itemState('dsa:p1', TODAY, { status: 'skipped', dueOn: null })
    const views = buildTodayPage(
      todayData(planState(storedPlan({ blocks })), {
        items: { 'english:e1': skipped, 'dsa:p1': reviewed },
      }),
      NO_ACTIVITY,
      REQUEST_ID,
    ).blocks
    // English new: 3 − 1.5 skipped → 2 (rounded up); dsa review: p1 was skipped after a result
    // on the plan date — studied, so it still counts (10).
    expect(views.map((view) => view.defaultMinutes)).toEqual([10, 50, 2, 10, 10, 5, 3, 10])
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
      progress: { week: 1, weeks: 2, introduced: 2, total: 5 },
    })
    // English 10w: W1 core cards e1–e4, W2 e5 e6 — 2 of 6 introduced (a mastered card counts).
    expect(english).toMatchObject({
      title: ENGLISH_TITLE,
      progress: { week: 1, weeks: 2, introduced: 2, total: 6 },
    })
    // m-1: exactly the track page's own numbers.
    const data = todayData(planState(storedPlan({ tracks })), { items })
    expect(dsa!.progress).toEqual(trackProgressOf(data.catalog, 'dsa', '8w', items))
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
      'Kế hoạch này được lập khi bạn có 52 mục cần ôn — tạm giảm bài mới.',
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

  it('counts due items only of tracks the engine plans today (UI I-2): /today’s total is /review’s', () => {
    // English removed and re-added with a start date next week keeps its item states (§5.9); DSA's
    // catalog track is active; both have due items.
    const nextWeek = '2026-10-05'
    const data = todayData(planState(storedPlan({ tracks })), {
      items,
      enrollments: [enrollment('dsa'), enrollment('english', { startDate: nextWeek })],
    })
    const page = buildTodayPage(data, NO_ACTIVITY, REQUEST_ID)
    expect(page.tracks.map((track) => [track.trackId, track.dueCount, track.startsOn])).toEqual([
      ['dsa', 1, null],
      ['english', 0, nextWeek],
    ])
    const total = page.tracks.reduce((sum, track) => sum + track.dueCount, 0)
    const review = reviewQueue({
      catalog: data.catalog,
      enrollments: data.enrollments,
      items,
      today: data.today,
    })
    expect(total).toBe(review.length)

    // A track the catalog retired, still an active enrollment: no due items counted either.
    const retired = todayData(planState(storedPlan({ tracks })), {
      items,
      catalog: {
        ...data.catalog,
        tracks: {
          ...data.catalog.tracks,
          english: { ...data.catalog.tracks.english!, status: 'retired' },
        },
      },
    })
    const retiredPage = buildTodayPage(retired, NO_ACTIVITY, REQUEST_ID)
    expect(retiredPage.tracks.map((track) => track.dueCount)).toEqual([1, 0])
    expect(retiredPage.tracks.reduce((sum, track) => sum + track.dueCount, 0)).toBe(
      reviewQueue({
        catalog: retired.catalog,
        enrollments: retired.enrollments,
        items,
        today: retired.today,
      }).length,
    )
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
        progress: { week: 1, weeks: 0, introduced: 0, total: 0 },
        dueCount: 0,
        startsOn: null,
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
      {
        trackId: 'dsa',
        topicId: 'arrays',
        title: 'Arrays & Hashing',
        trackTitle: DSA_TITLE,
        count: 3,
      },
      {
        trackId: 'dsa',
        topicId: 'two-pointers',
        title: 'Two Pointers',
        trackTitle: DSA_TITLE,
        count: 2,
      },
    ])
  })

  it('leaves out a track that has not started yet, as /review does (UI I-2)', () => {
    const weak = (id: string) => itemState(id, '2026-09-20', { status: 'weak', weak: true })
    const items = Object.fromEntries(
      ['dsa:p1', 'dsa:p2', 'english:e1', 'english:e2'].map((id) => [id, weak(id)]),
    )
    const page = buildTodayPage(
      todayData(planState(), {
        items,
        enrollments: [enrollment('dsa', { startDate: '2026-10-05' }), enrollment('english')],
      }),
      NO_ACTIVITY,
      REQUEST_ID,
    )
    expect(page.weakTopics.map((topic) => topic.trackId)).toEqual(['english'])
  })
})

describe('buildTodayPage — ?block= (5.2b, §2.4)', () => {
  const yesterday = '2026-09-27'
  const oldBlocks = [
    block(`${yesterday}:dsa:review:1`, { kind: 'review', trackId: 'dsa' }),
    block(`${yesterday}:dsa:new:1`, { kind: 'new', trackId: 'dsa' }),
  ]
  const old = storedPlan({ id: OLD_PLAN_ID, planDate: yesterday, blocks: oldBlocks })

  it('opens the sheet for a block the dashboard shows', () => {
    const blocks = [block(`${TODAY}:dsa:new:1`, { kind: 'new', trackId: 'dsa' })]
    const page = buildTodayPage(
      todayData(planState(storedPlan({ blocks }))),
      NO_ACTIVITY,
      REQUEST_ID,
      `${TODAY}:dsa:new:1`,
    )
    expect(page.openBlockId).toBe(`${TODAY}:dsa:new:1`)
    const resumed = buildTodayPage(
      todayData({ kind: 'resumed', plan: old, blocks: {} }),
      NO_ACTIVITY,
      REQUEST_ID,
      `${yesterday}:dsa:review:1`,
    )
    expect(resumed.openBlockId).toBe(`${yesterday}:dsa:review:1`)
  })

  it('opens nothing for an unknown id, no id, or a block the dashboard does not show', () => {
    const plan = planState(storedPlan({ blocks: [oldBlocks[0]!] }))
    expect(buildTodayPage(todayData(plan), NO_ACTIVITY, REQUEST_ID, 'nope').openBlockId).toBeNull()
    expect(buildTodayPage(todayData(plan), NO_ACTIVITY, REQUEST_ID).openBlockId).toBeNull()
    expect(buildTodayPage(todayData(plan), NO_ACTIVITY, REQUEST_ID, '').openBlockId).toBeNull()
    // The paused view lists only unfinished blocks: a finished one is not opened.
    const paused = buildTodayPage(
      todayData({
        kind: 'paused',
        plan: old,
        unfinished: [oldBlocks[1]!],
        blocks: {},
        daysSince: 1,
        offerResume: false,
      }),
      NO_ACTIVITY,
      REQUEST_ID,
      `${yesterday}:dsa:review:1`,
    )
    expect(paused.openBlockId).toBeNull()
    for (const state of [
      { kind: 'notStarted', startDate: '2026-10-03' },
      { kind: 'noTracks' },
      { kind: 'unreadable' },
    ] satisfies TodayState[]) {
      expect(
        buildTodayPage(todayData(state), NO_ACTIVITY, REQUEST_ID, `${TODAY}:dsa:new:1`).openBlockId,
      ).toBeNull()
    }
  })
})

describe('buildTodayPage — AI plans (task 6.5b, decision 16)', () => {
  const RATIONALE = 'Ôn lại Two Sum trước, sau đó học tiếp Stack.'
  const ai = storedPlan({ source: 'ai', rationale: RATIONALE, version: 2 })

  it('an AI plan carries the badge with its rationale; a baseline plan carries nothing (v1.0)', () => {
    expect(buildTodayPage(todayData(planState(ai)), NO_ACTIVITY, REQUEST_ID).aiPlan).toEqual({
      rationale: RATIONALE,
    })
    expect(
      buildTodayPage(todayData(planState(storedPlan())), NO_ACTIVITY, REQUEST_ID).aiPlan,
    ).toBeNull()
  })

  it('an AI plan without a rationale still carries the badge', () => {
    const plain = storedPlan({ source: 'ai', rationale: null })
    expect(buildTodayPage(todayData(planState(plain)), NO_ACTIVITY, REQUEST_ID).aiPlan).toEqual({
      rationale: null,
    })
  })

  it('the paused and resumed views show it when their plan is an AI plan; the other states never', () => {
    const shown: TodayState[] = [
      { kind: 'resumed', plan: ai, blocks: {} },
      { kind: 'paused', plan: ai, unfinished: [], blocks: {}, daysSince: 3, offerResume: true },
    ]
    for (const state of shown) {
      expect(buildTodayPage(todayData(state), NO_ACTIVITY, REQUEST_ID).aiPlan).toEqual({
        rationale: RATIONALE,
      })
    }
    const none: TodayState[] = [
      { kind: 'notStarted', startDate: '2026-10-03' },
      { kind: 'noTracks' },
      { kind: 'unreadable' },
    ]
    for (const state of none) {
      expect(buildTodayPage(todayData(state), NO_ACTIVITY, REQUEST_ID).aiPlan).toBeNull()
    }
  })

  it('links a custom item of an AI plan’s block to its own page (decision 39), with ?block= and ?mode=', () => {
    const custom = 'user:0123456789abcdef:ah-card'
    const plan = storedPlan({
      source: 'ai',
      blocks: [
        block(`${TODAY}:dsa:practice:1`, {
          kind: 'practice',
          trackId: 'dsa',
          items: [{ itemId: custom, mode: 'review', minutes: 2 }],
        }),
      ],
    })
    const page = buildTodayPage(todayData(planState(plan)), NO_ACTIVITY, REQUEST_ID)
    expect(parsed(page.blocks[0]!.items[0]!.href)).toEqual({
      path: `/t/dsa/items/${encodeURIComponent(custom)}`,
      block: `${TODAY}:dsa:practice:1`,
      mode: 'review',
    })
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

describe('buildTodayPage — "Học thêm" (task 5.4, decision 20)', () => {
  it('offers it per active, started track in the plan and resumed states', () => {
    const plan = storedPlan({ tracks: { dsa: SNAPSHOT, english: { ...SNAPSHOT, variant: '10w' } } })
    for (const state of [planState(plan), { kind: 'resumed', plan, blocks: {} } as const]) {
      expect(buildTodayPage(todayData(state), NO_ACTIVITY, REQUEST_ID).extra).toEqual([
        { trackId: 'dsa', trackTitle: DSA_TITLE, accent: 'track-1', newPaused: false },
        { trackId: 'english', trackTitle: ENGLISH_TITLE, accent: 'track-2', newPaused: false },
      ])
    }
  })

  it('marks new items paused when the plan caps the track at 0 new items (§5.5, UI I-5)', () => {
    const plan = storedPlan({
      tracks: {
        dsa: SNAPSHOT,
        english: { ...SNAPSHOT, variant: '10w', dueCount: 61, newPerDay: 0, throttled: true },
      },
    })
    const page = buildTodayPage(todayData(planState(plan)), NO_ACTIVITY, REQUEST_ID)
    expect(page.extra.map((view) => [view.trackId, view.newPaused])).toEqual([
      ['dsa', false],
      ['english', true],
    ])
  })

  it('leaves out paused, removed and not-started tracks', () => {
    const data = todayData(planState(), {
      enrollments: [
        enrollment('dsa', { status: 'paused' }),
        enrollment('english', { startDate: '2026-10-01' }),
      ],
    })
    expect(buildTodayPage(data, NO_ACTIVITY, REQUEST_ID).extra).toEqual([])
    const removed = todayData(planState(), {
      enrollments: [enrollment('dsa', { status: 'removed' }), enrollment('english')],
    })
    expect(
      buildTodayPage(removed, NO_ACTIVITY, REQUEST_ID).extra.map((view) => view.trackId),
    ).toEqual(['english'])
  })

  it('leaves out a track whose catalog track is not active (the engine’s eligibility, M-4)', () => {
    const catalog = todayData(planState()).catalog
    const data = todayData(planState(), {
      catalog: {
        ...catalog,
        tracks: { ...catalog.tracks, dsa: { ...catalog.tracks.dsa!, status: 'retired' } },
      },
    })
    expect(buildTodayPage(data, NO_ACTIVITY, REQUEST_ID).extra.map((view) => view.trackId)).toEqual(
      ['english'],
    )
  })

  it('offers nothing in the paused view and the states without a plan', () => {
    const plan = storedPlan()
    const states: TodayState[] = [
      { kind: 'paused', plan, unfinished: [], blocks: {}, daysSince: 1, offerResume: false },
      { kind: 'notStarted', startDate: '2026-10-03' },
      { kind: 'noTracks' },
      { kind: 'unreadable' },
    ]
    for (const state of states) {
      expect(buildTodayPage(todayData(state), NO_ACTIVITY, REQUEST_ID).extra).toEqual([])
    }
  })
})
