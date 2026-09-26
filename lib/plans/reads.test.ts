import { describe, expect, it } from 'vitest'
import { CATALOG, itemState } from '@/lib/domain/plan/__tests__/fixtures'
import { blockKey } from '@/lib/domain/state'
import { createFakeSupabase } from '@/lib/testing/fake-supabase'
import {
  blockStateRow,
  eventRow,
  itemStateRow,
  OTHER_USER_ID,
  planBlock,
  planRow,
  scheduleRow,
  storedOf,
  TODAY,
  trackRow,
  USER_ID,
  YESTERDAY,
} from './__tests__/fixtures'
import {
  readBlockStates,
  readDailyActivity,
  readEnrollments,
  readItemStates,
  readLastSeenPlan,
  readPlan,
  readPlanById,
  readPlanMode,
  readRecapHistory,
  readScheduleVersions,
  todayOf,
} from './reads'

describe('readScheduleVersions', () => {
  it("reads the user's versions oldest first, day starts as HH:MM and instants as ISO UTC", async () => {
    const fake = createFakeSupabase({
      schedule_versions: [
        scheduleRow({ effective_at: '2026-09-20T21:00:00+00:00', timezone: 'Europe/Berlin' }),
        scheduleRow({ user_id: OTHER_USER_ID }),
        scheduleRow({ day_starts_at: '05:30:00' }),
      ],
    })
    expect(await readScheduleVersions(fake.client(), USER_ID)).toEqual([
      {
        timezone: 'Asia/Ho_Chi_Minh',
        dayStartsAt: '05:30',
        effectiveAt: '2026-09-01T00:00:00.000Z',
      },
      { timezone: 'Europe/Berlin', dayStartsAt: '04:00', effectiveAt: '2026-09-20T21:00:00.000Z' },
    ])
  })

  it('throws when the query fails', async () => {
    const fake = createFakeSupabase()
    fake.failSelect('schedule_versions', 'boom')
    await expect(readScheduleVersions(fake.client(), USER_ID)).rejects.toThrow(/schedule/)
  })
})

describe('todayOf', () => {
  const HCM = [
    { timezone: 'Asia/Ho_Chi_Minh', dayStartsAt: '04:00', effectiveAt: '2026-09-01T00:00:00.000Z' },
  ]

  it('[RF-1] 01:30 in Ho Chi Minh with day start 04:00 is still the previous date', () => {
    // 2026-09-29 01:30 +07:00
    expect(todayOf(HCM, new Date('2026-09-28T18:30:00.000Z'))).toBe('2026-09-28')
    // 2026-09-29 04:00 +07:00
    expect(todayOf(HCM, new Date('2026-09-28T21:00:00.000Z'))).toBe('2026-09-29')
  })

  it('uses the version in force at `now`, and the default schedule without one', () => {
    const berlinLater = [
      ...HCM,
      { timezone: 'Europe/Berlin', dayStartsAt: '00:00', effectiveAt: '2026-10-01T00:00:00.000Z' },
    ]
    expect(todayOf(berlinLater, new Date('2026-09-28T18:30:00.000Z'))).toBe('2026-09-28')
    expect(todayOf(berlinLater, new Date('2026-10-01T22:30:00.000Z'))).toBe('2026-10-02')
    expect(todayOf([], new Date('2026-09-28T18:30:00.000Z'))).toBe('2026-09-28')
  })
})

describe('readEnrollments', () => {
  it('reads every enrollment (removed ones too) through toEnrollment, dropping unknown tracks', async () => {
    const fake = createFakeSupabase({
      user_tracks: [
        trackRow('english', { status: 'removed', new_per_day: 3 }),
        trackRow('dsa', { budget_minutes: 90, reset_on: '2026-09-20' }),
        trackRow('ghost'),
        trackRow('dsa', { user_id: OTHER_USER_ID }),
      ],
    })
    const enrollments = await readEnrollments(fake.client(), USER_ID, CATALOG)
    expect(enrollments).toEqual([
      {
        trackId: 'dsa',
        variant: '8w',
        status: 'active',
        startDate: TODAY,
        budgetMinutes: 90,
        newPerDay: null,
        throttle: [],
        weeklyTemplate: CATALOG.tracks.dsa?.weeklyTemplate,
        includeBonus: false,
        resetOn: '2026-09-20',
      },
      expect.objectContaining({ trackId: 'english', status: 'removed', newPerDay: 3 }),
    ])
  })

  it('falls back to the track template when the stored one has a block too long to store (M-4)', async () => {
    const templateOf = async (minutes: number) => {
      const template = { 'mon-fri': [{ kind: 'practice', tag: 'mock-interview', minutes }] }
      const fake = createFakeSupabase({
        user_tracks: [trackRow('dsa', { weekly_template: template })],
      })
      const [dsa] = await readEnrollments(fake.client(), USER_ID, CATALOG)
      return { stored: template, read: dsa?.weeklyTemplate }
    }
    const fits = await templateOf(60)
    expect(fits.read).toEqual(fits.stored)
    expect((await templateOf(700)).read).toBe(CATALOG.tracks.dsa?.weeklyTemplate)
  })
})

describe('readItemStates', () => {
  const rows = (count: number, userId = USER_ID) =>
    Array.from({ length: count }, (_, i) =>
      itemStateRow(
        itemState('dsa:p1', '2026-09-01', { itemId: `dsa:item-${String(i).padStart(5, '0')}` }),
        userId,
      ),
    )

  it.each([1, 999, 1000, 1001, 5000])(
    'returns all %i rows of the user, paging by item_id (max_rows = 1000)',
    async (count) => {
      const fake = createFakeSupabase({ item_state: [...rows(count), ...rows(3, OTHER_USER_ID)] })
      const items = await readItemStates(fake.client(), USER_ID)
      expect(Object.keys(items)).toHaveLength(count)
      for (const select of fake.selects('item_state')) {
        expect(select.order).toEqual([{ column: 'item_id', ascending: true }])
        expect(select.range).not.toBeNull()
        expect(select.filters).toContainEqual({ op: 'eq', column: 'user_id', value: USER_ID })
      }
      // Pages of 1000, and no request past the 5000-row cap.
      expect(fake.selects('item_state')).toHaveLength(Math.min(5, Math.floor(count / 1000) + 1))
    },
  )

  it('maps each row to the engine state, keyed by item id', async () => {
    const state = itemState('dsa:p2', '2026-09-20', { weak: true, status: 'weak', dueOn: TODAY })
    const fake = createFakeSupabase({ item_state: [itemStateRow(state)] })
    expect(await readItemStates(fake.client(), USER_ID)).toEqual({ 'dsa:p2': state })
  })
})

describe('readPlan, readPlanById', () => {
  const block = planBlock(TODAY, 'dsa', 'new', ['dsa:p1'])

  it("reads the user's plan of a date, parsed", async () => {
    const row = planRow({ date: TODAY, blocks: [block] })
    const fake = createFakeSupabase({
      day_plans: [row, planRow({ date: TODAY, userId: OTHER_USER_ID })],
    })
    expect(await readPlan(fake.client(), USER_ID, TODAY)).toEqual({ row, plan: storedOf(row) })
    expect(await readPlan(fake.client(), USER_ID, YESTERDAY)).toBeNull()
    expect(await readPlanById(fake.client(), USER_ID, row.id)).toEqual({ row, plan: storedOf(row) })
  })

  it('keeps an unreadable row with plan null (M-4)', async () => {
    const row = planRow({ date: TODAY, blocks: [{ ...block, kind: 'mystery' }] })
    const fake = createFakeSupabase({ day_plans: [row] })
    expect(await readPlan(fake.client(), USER_ID, TODAY)).toEqual({ row, plan: null })
  })

  it("never returns another user's plan by id", async () => {
    const row = planRow({ date: TODAY, userId: OTHER_USER_ID })
    const fake = createFakeSupabase({ day_plans: [row] })
    expect(await readPlanById(fake.client(), USER_ID, row.id)).toBeNull()
  })
})

describe('readLastSeenPlan', () => {
  it('asks for seen_at not null, plan_date < today, newest first, one row (decision 7)', async () => {
    const seen = planRow({ date: '2026-09-25', seenAt: '2026-09-25T03:00:00Z' })
    const fake = createFakeSupabase({
      day_plans: [
        planRow({ date: '2026-09-20', seenAt: '2026-09-20T03:00:00Z' }),
        seen,
        planRow({ date: YESTERDAY }),
        planRow({ date: TODAY, seenAt: '2026-09-28T03:00:00Z' }),
        planRow({ date: '2026-09-26', seenAt: '2026-09-26T03:00:00Z', userId: OTHER_USER_ID }),
      ],
    })
    expect(await readLastSeenPlan(fake.client(), USER_ID, TODAY)).toEqual({
      row: seen,
      plan: storedOf(seen),
    })
    const [select] = fake.selects('day_plans')
    expect(select?.filters).toEqual(
      expect.arrayContaining([
        { op: 'eq', column: 'user_id', value: USER_ID },
        { op: 'not.is', column: 'seen_at', value: null },
        { op: 'lt', column: 'plan_date', value: TODAY },
      ]),
    )
    expect(select?.filters).toHaveLength(3)
    expect(select?.order).toEqual([{ column: 'plan_date', ascending: false }])
    expect(select?.limit).toBe(1)
  })

  it('is null without a seen plan before today', async () => {
    const fake = createFakeSupabase({ day_plans: [planRow({ date: YESTERDAY })] })
    expect(await readLastSeenPlan(fake.client(), USER_ID, TODAY)).toBeNull()
  })
})

describe('readBlockStates', () => {
  it('reads the block states of the plans, keyed by blockKey', async () => {
    const plan = planRow({ date: YESTERDAY })
    const other = planRow({ date: '2026-09-26' })
    const block = planBlock(YESTERDAY, 'dsa', 'new', ['dsa:p1'])
    const fake = createFakeSupabase({
      plan_block_state: [
        blockStateRow(plan, block, 'done', TODAY),
        blockStateRow(other, block, 'skipped', '2026-09-26'),
      ],
    })
    expect(await readBlockStates(fake.client(), [plan.id])).toEqual({
      [blockKey(plan.id, block.id)]: {
        planId: plan.id,
        blockId: block.id,
        trackId: 'dsa',
        status: 'done',
        minutes: 10,
        note: null,
        auto: false,
        checkedInOn: TODAY,
      },
    })
  })

  it('makes no request for no plans', async () => {
    const fake = createFakeSupabase()
    expect(await readBlockStates(fake.client(), [])).toEqual({})
    expect(fake.calls).toEqual([])
  })
})

describe('readRecapHistory', () => {
  it('asks only for plans with a recap block (jsonb containment) and their block states', async () => {
    const recap = planBlock('2026-09-27', 'dsa', 'recap', ['dsa:p4'], { recapWeek: 1 })
    const withRecap = planRow({
      date: '2026-09-27',
      blocks: [planBlock('2026-09-27', 'dsa', 'review', []), recap],
    })
    const fake = createFakeSupabase({
      day_plans: [
        withRecap,
        planRow({
          date: '2026-09-26',
          blocks: [planBlock('2026-09-26', 'dsa', 'new', ['dsa:p1'])],
        }),
        planRow({ date: '2026-09-20', blocks: [{ ...recap, kind: 'recap', estMinutes: -1 }] }),
        planRow({ date: '2026-09-27', blocks: [recap], userId: OTHER_USER_ID }),
      ],
      plan_block_state: [blockStateRow(withRecap, recap, 'done', '2026-09-27')],
    })
    const history = await readRecapHistory(fake.client(), USER_ID)
    expect(history.plans).toEqual([storedOf(withRecap)])
    expect(Object.keys(history.blocks)).toEqual([blockKey(withRecap.id, recap.id)])

    const [select] = fake.selects('day_plans')
    expect(select?.filters).toEqual([
      { op: 'eq', column: 'user_id', value: USER_ID },
      { op: 'contains', column: 'blocks', value: [{ kind: 'recap' }] },
    ])
    // Only recap check-ins, by the user, not a growing list of plan ids.
    const [states] = fake.selects('plan_block_state')
    expect(states?.filters).toEqual([
      { op: 'eq', column: 'user_id', value: USER_ID },
      { op: 'like', column: 'block_id', value: '%:recap:%' },
    ])
  })

  it('[RF-4] pages the recap check-ins past max_rows (1000)', async () => {
    const recap = (n: number) =>
      planBlock('2026-09-27', 'dsa', 'recap', [], { id: `2026-09-27:dsa:recap:${n}` })
    const plan = planRow({ date: '2026-09-27', blocks: [recap(1)] })
    const fake = createFakeSupabase({
      day_plans: [plan],
      plan_block_state: [
        ...Array.from({ length: 1500 }, (_, n) => blockStateRow(plan, recap(n + 1), 'done', TODAY)),
        blockStateRow(plan, planBlock('2026-09-27', 'dsa', 'new', []), 'done', TODAY),
        { ...blockStateRow(plan, recap(9999), 'done', TODAY), user_id: OTHER_USER_ID },
      ],
    })
    const history = await readRecapHistory(fake.client(), USER_ID)
    expect(history.plans).toEqual([storedOf(plan)])
    expect(Object.keys(history.blocks)).toHaveLength(1500)
    const pages = fake.selects('plan_block_state')
    expect(pages.map((page) => page.range)).toEqual([
      [0, 999],
      [1000, 1999],
    ])
    for (const page of pages) {
      expect(page.order).toEqual([
        { column: 'plan_id', ascending: true },
        { column: 'block_id', ascending: true },
      ])
    }
  })
})

describe('readRecapHistory without a recap plan', () => {
  it('reads no check-ins', async () => {
    const fake = createFakeSupabase({ day_plans: [planRow({ date: TODAY })] })
    expect(await readRecapHistory(fake.client(), USER_ID)).toEqual({ plans: [], blocks: {} })
    expect(fake.selects('plan_block_state')).toEqual([])
  })
})

describe('readDailyActivity', () => {
  it('reads the days from `from` on, keyed by local day', async () => {
    const day = (localDay: string, userId = USER_ID) => ({
      user_id: userId,
      local_day: localDay,
      minutes_by_track: { dsa: 30 },
      items_done: 2,
      completed: true,
      version: 1,
      rules_version: 3,
    })
    const fake = createFakeSupabase({
      daily_activity: [day('2026-09-01'), day(YESTERDAY), day(TODAY), day(TODAY, OTHER_USER_ID)],
    })
    const days = await readDailyActivity(fake.client(), USER_ID, '2026-09-10')
    expect(Object.keys(days)).toEqual([YESTERDAY, TODAY])
    expect(days[TODAY]).toEqual({
      localDay: TODAY,
      minutesByTrack: { dsa: 30 },
      itemsDone: 2,
      completed: true,
    })
  })
})

describe('readPlanMode', () => {
  it("is the mode of the plan's latest plan.generated event, null when none", async () => {
    const plan = planRow({ date: TODAY })
    const fake = createFakeSupabase({
      events: [
        eventRow({
          type: 'plan.generated',
          plan_id: plan.id,
          payload: { mode: 'resume', planVersion: 1 },
        }),
        eventRow({
          type: 'plan.generated',
          plan_id: plan.id,
          payload: { mode: 'rebuild', planVersion: 2 },
        }),
        eventRow({ type: 'item.result', plan_id: plan.id, payload: { mode: 'baseline' } }),
      ],
    })
    expect(await readPlanMode(fake.client(), USER_ID, plan.id)).toBe('rebuild')
    expect(await readPlanMode(fake.client(), USER_ID, planRow({ date: YESTERDAY }).id)).toBeNull()
  })

  it('reads an unexpected payload as null', async () => {
    const plan = planRow({ date: TODAY })
    const fake = createFakeSupabase({
      events: [eventRow({ type: 'plan.generated', plan_id: plan.id, payload: { mode: 'ai' } })],
    })
    expect(await readPlanMode(fake.client(), USER_ID, plan.id)).toBeNull()
  })
})
