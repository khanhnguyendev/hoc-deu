import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { itemState } from '@/lib/domain/plan/__tests__/fixtures'
import type { PlanBlock } from '@/lib/domain/plan/types'
import { RULES_VERSION } from '@/lib/domain/rules'
import type { LocalDay } from '@/lib/domain/time/localDay'
import { deriveEventId } from '@/lib/events/ids'
import { vi as copy } from '@/lib/i18n/vi'
import {
  blockStateRow,
  itemStateRow,
  planBlock,
  planRow,
  scheduleRow,
  TODAY,
  trackRow,
  USER_ID,
  YESTERDAY,
} from '@/lib/plans/__tests__/fixtures'
import {
  createFakeSupabase,
  type FakeRows,
  type FakeSupabase,
  type RowOf,
} from '@/lib/testing/fake-supabase'
import { databaseDay, eventStore, type StoreArgs, type Step } from './__tests__/event-store'
import type { CheckInInput, OutcomeInput } from './schema'

const state = vi.hoisted(() => ({
  log: [] as unknown[][],
  /** The guard throws this (a redirect) when set. */
  denied: null as Error | null,
  userId: '5b0c61a2-7f5e-4c3b-9a41-2f1d7c8e9a10',
  fake: null as unknown as import('@/lib/testing/fake-supabase').FakeSupabase,
  /** Runs when the auto check-in reads the item states (another request landing then). */
  onLoadItemStates: null as (() => void) | null,
}))

vi.mock('next/cache', () => ({
  revalidatePath: (path: string) => {
    state.log.push(['revalidatePath', path])
  },
}))
vi.mock('@/lib/auth/dal', () => ({
  requireOnboarded: async () => {
    state.log.push(['requireOnboarded'])
    if (state.denied !== null) throw state.denied
    return { id: state.userId }
  },
  getSessionUser: async () => ({ id: state.userId }),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    state.log.push(['createClient'])
    return state.fake.client('session')
  },
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => state.fake.client('admin'),
}))
vi.mock('@/lib/events/load-derived', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/events/load-derived')>()
  return {
    ...real,
    loadItemStates: (...args: Parameters<typeof real.loadItemStates>) => {
      state.onLoadItemStates?.()
      return real.loadItemStates(...args)
    },
  }
})
vi.mock('@/lib/plans/catalog', async () => {
  const { CATALOG } = await import('@/lib/domain/plan/__tests__/fixtures')
  return { planCatalog: () => CATALOG }
})

const { checkInBlock, recordOutcome } = await import('./actions')

const REQUEST_ID = '3f2a1b0c-9d8e-4f7a-8b6c-5d4e3f2a1b0c'
/** 10:00 on TODAY in Ho Chi Minh (day start 04:00). */
const NOW = new Date('2026-09-28T03:00:00.000Z')
/** 03:59:59 on 2026-09-29 in Ho Chi Minh: still TODAY; one second before the day start. */
const BEFORE_DAY_START = new Date('2026-09-28T20:59:59.000Z')
const AFTER_DAY_START = new Date('2026-09-28T21:00:01.000Z')
const TOMORROW: LocalDay = '2026-09-29'
const seen = (date: LocalDay) => `${date}T03:00:00.000Z`

/** The fake with the learner's schedule and tracks (started long ago), `rows` and the store. */
function setup(rows: FakeRows = {}, script: Parameters<typeof eventStore>[2] = {}): FakeSupabase {
  const fake = createFakeSupabase({
    schedule_versions: [scheduleRow()],
    user_tracks: [
      trackRow('dsa', { start_date: '2026-09-01' }),
      trackRow('english', { start_date: '2026-09-01' }),
    ],
    ...rows,
  })
  eventStore(fake, USER_ID, script)
  state.fake = fake
  return fake
}

const learnerCalls = (fake: FakeSupabase) =>
  fake.rpcs('apply_event').map((call) => ({ client: call.client, ...(call.args as StoreArgs) }))
const systemCalls = (fake: FakeSupabase) =>
  fake.rpcs('apply_system_event').map((call) => ({
    client: call.client,
    ...(call.args as StoreArgs),
  }))
const blockRow = (fake: FakeSupabase, planId: string, blockId: string) =>
  fake.tables.plan_block_state?.find((row) => row.plan_id === planId && row.block_id === blockId)
const dayRow = (fake: FakeSupabase, day: LocalDay) =>
  fake.tables.daily_activity?.find((row) => row.local_day === day)

/** A result on `day` for `itemId`: the item is handled for plans dated up to `day`. */
const handled = (itemId: string, day: LocalDay = TODAY) => itemStateRow(itemState(itemId, day))

beforeEach(() => {
  state.log = []
  state.denied = null
  state.onLoadItemStates = null
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

// ---------------------------------------------------------------------------------------------
// checkInBlock
// ---------------------------------------------------------------------------------------------

describe('checkInBlock', () => {
  const block = planBlock(TODAY, 'dsa', 'new', ['dsa:p1', 'dsa:p2'])
  const plan = planRow({ date: TODAY, blocks: [block], seenAt: seen(TODAY) })
  const input = (change: Partial<CheckInInput> = {}): CheckInInput => ({
    requestId: REQUEST_ID,
    planId: plan.id,
    blockId: block.id,
    status: 'done',
    ...change,
  })

  it('runs the guard first, then records the check-in with its derived rows', async () => {
    const fake = setup({ day_plans: [plan] })
    expect(await checkInBlock(input({ minutes: 25 }))).toEqual({
      ok: true,
      message: copy.checkIn.checkedIn.done,
    })
    expect(state.log.slice(0, 2)).toEqual([['requireOnboarded'], ['createClient']])
    expect(state.log).toContainEqual(['revalidatePath', '/today'])
    const [call] = learnerCalls(fake)
    expect(call).toMatchObject({
      client: 'session',
      p_event: {
        type: 'block.checked_in',
        plan_id: plan.id,
        block_id: block.id,
        track_id: 'dsa',
        local_day: TODAY,
        payload: { status: 'done', minutes: 25 },
        rules_version: RULES_VERSION,
      },
    })
    expect(blockRow(fake, plan.id, block.id)).toMatchObject({
      status: 'done',
      minutes: 25,
      auto: false,
      checked_in_on: TODAY,
    })
    expect(dayRow(fake, TODAY)).toMatchObject({ completed: true, minutes_by_track: { dsa: 25 } })
    expect(fake.rpcs('apply_system_event')).toEqual([])
  })

  it('reads and writes nothing when the guard redirects', async () => {
    const fake = setup({ day_plans: [plan] })
    state.denied = new Error('REDIRECT:/onboarding')
    await expect(checkInBlock(input())).rejects.toThrow('REDIRECT:/onboarding')
    expect(state.log).toEqual([['requireOnboarded']])
    expect(fake.calls).toEqual([])
  })

  it('one-tap (no minutes) records checkInMinutes(block): a 7.5-minute block gives 8', async () => {
    const short = planBlock(TODAY, 'english', 'review', ['english:e1'], { estMinutes: 7.5 })
    const shortPlan = planRow({ date: TODAY, blocks: [short], seenAt: seen(TODAY) })
    const fake = setup({ day_plans: [shortPlan] })
    await checkInBlock(input({ planId: shortPlan.id, blockId: short.id }))
    expect(learnerCalls(fake)[0]?.p_event.payload).toEqual({ status: 'done', minutes: 8 })
  })

  it('stores a note as NFC and sends it in the payload', async () => {
    const fake = setup({ day_plans: [plan] })
    await checkInBlock(
      input({ status: 'partial', minutes: 10, note: ` Khó ${'ệ'.normalize('NFD')} ` }),
    )
    expect(learnerCalls(fake)[0]?.p_event.payload).toEqual({
      status: 'partial',
      minutes: 10,
      note: 'Khó ệ',
    })
    expect(blockRow(fake, plan.id, block.id)?.note).toBe('Khó ệ')
  })

  it('refuses a note over 280 graphemes with its message, reading nothing', async () => {
    const fake = setup({ day_plans: [plan] })
    expect(await checkInBlock(input({ note: 'a'.repeat(281) }))).toEqual({
      ok: false,
      message: copy.checkIn.errors.noteTooLong,
    })
    expect(fake.calls).toEqual([])
  })

  it('refuses an invalid input, reading nothing', async () => {
    const fake = setup({ day_plans: [plan] })
    const bad = { ...input(), status: 'finished' } as unknown as CheckInInput
    expect(await checkInBlock(bad)).toEqual({ ok: false, message: copy.checkIn.errors.invalid })
    expect(fake.calls).toEqual([])
  })

  it('[RF-2] the same input twice is one event: the second answer is a duplicate, and success', async () => {
    const fake = setup({ day_plans: [plan] })
    const first = await checkInBlock(input())
    const second = await checkInBlock(input())
    expect(second).toEqual(first)
    expect(second.ok).toBe(true)
    const [one, two] = learnerCalls(fake)
    expect(two?.p_event.id).toBe(one?.p_event.id)
    expect(fake.tables.events).toHaveLength(1)
  })

  it('a different status in the same render is a new event', async () => {
    const fake = setup({ day_plans: [plan] })
    await checkInBlock(input())
    await checkInBlock(input({ status: 'partial' }))
    expect(fake.tables.events).toHaveLength(2)
    expect(blockRow(fake, plan.id, block.id)).toMatchObject({ status: 'partial', version: 2 })
  })

  it('[RF-2] a version conflict reloads and retries: two attempts, one event', async () => {
    const other = planBlock(TODAY, 'english', 'review', ['english:e1'])
    const both = planRow({ date: TODAY, blocks: [block, other], seenAt: seen(TODAY) })
    // Another tab checks in the English block between this request's reads and its write.
    const race: Step = () => {
      const fake = state.fake
      fake.tables.plan_block_state?.push(blockStateRow(both, other, 'done', TODAY))
      fake.tables.daily_activity?.push({
        user_id: USER_ID,
        local_day: TODAY,
        minutes_by_track: { english: 10 },
        items_done: 0,
        completed: true,
        version: 1,
        rules_version: RULES_VERSION,
      })
    }
    const fake = setup(
      { day_plans: [both], plan_block_state: [], daily_activity: [] },
      {
        learner: [race],
      },
    )
    expect((await checkInBlock(input({ planId: both.id, status: 'skipped', minutes: 0 }))).ok).toBe(
      true,
    )
    const calls = learnerCalls(fake)
    expect(calls).toHaveLength(2)
    expect(calls[1]?.p_event.id).toBe(calls[0]?.p_event.id)
    expect(fake.tables.events).toHaveLength(1)
    // The retry saw the other block: the day stays completed.
    expect(dayRow(fake, TODAY)).toMatchObject({
      completed: true,
      minutes_by_track: { english: 10, dsa: 0 },
      version: 2,
    })
  })

  it('[RF-1] day_changed retries on the new day against the plan current then (the paused plan)', async () => {
    vi.setSystemTime(BEFORE_DAY_START)
    const crossDayStart: Step = () => {
      vi.setSystemTime(AFTER_DAY_START)
    }
    const fake = setup({ day_plans: [plan] }, { learner: [crossDayStart] })
    expect(await checkInBlock(input())).toEqual({ ok: true, message: copy.checkIn.checkedIn.done })
    expect(learnerCalls(fake).map((call) => call.p_event.local_day)).toEqual([TODAY, TOMORROW])
    expect(blockRow(fake, plan.id, block.id)?.checked_in_on).toBe(TOMORROW)
  })

  it('[RF-1] day_changed while the named plan is no longer current on the new day: stale, one write', async () => {
    vi.setSystemTime(BEFORE_DAY_START)
    const other = planBlock(TODAY, 'english', 'review', ['english:e1'])
    const both = planRow({ date: TODAY, blocks: [block, other], seenAt: seen(TODAY) })
    const crossDayStart: Step = () => {
      vi.setSystemTime(AFTER_DAY_START)
    }
    // The English block is done: on the new day the gate is open and today's plan is not built.
    const fake = setup(
      { day_plans: [both], plan_block_state: [blockStateRow(both, other, 'done', TODAY)] },
      { learner: [crossDayStart] },
    )
    expect(await checkInBlock(input({ planId: both.id }))).toEqual({
      ok: false,
      message: copy.checkIn.errors.stale,
    })
    expect(learnerCalls(fake)).toHaveLength(1)
    expect(fake.tables.events ?? []).toEqual([])
    expect(state.log).toContainEqual(['revalidatePath', '/today'])
  })

  it('refuses a check-in for a plan that is not current as stale, writing nothing', async () => {
    const old = planRow({
      date: YESTERDAY,
      blocks: [planBlock(YESTERDAY, 'dsa', 'new', ['dsa:p1'])],
    })
    const fake = setup({ day_plans: [plan, old] })
    const oldBlock = planBlock(YESTERDAY, 'dsa', 'new', ['dsa:p1'])
    expect(await checkInBlock(input({ planId: old.id, blockId: oldBlock.id }))).toEqual({
      ok: false,
      message: copy.checkIn.errors.stale,
    })
    expect(fake.rpcs()).toEqual([])
    expect(state.log).toContainEqual(['revalidatePath', '/today'])
  })

  it('refuses a block the current plan does not have (a rebuilt plan) as stale', async () => {
    const fake = setup({ day_plans: [plan] })
    expect(await checkInBlock(input({ blockId: `${TODAY}:dsa:new:9` }))).toEqual({
      ok: false,
      message: copy.checkIn.errors.stale,
    })
    expect(fake.rpcs()).toEqual([])
  })

  it('refuses as stale when there is no current plan (today not built yet)', async () => {
    const fake = setup({})
    expect((await checkInBlock(input())).message).toBe(copy.checkIn.errors.stale)
    expect(fake.rpcs()).toEqual([])
  })

  it('M-6 (a): a skipped block of the paused plan checked in done today counts for today', async () => {
    const old = planBlock(YESTERDAY, 'dsa', 'new', ['dsa:p1'])
    const paused = planRow({ date: YESTERDAY, blocks: [old], seenAt: seen(YESTERDAY) })
    const fake = setup({
      day_plans: [paused],
      plan_block_state: [blockStateRow(paused, old, 'skipped', YESTERDAY)],
      daily_activity: [
        {
          user_id: USER_ID,
          local_day: YESTERDAY,
          minutes_by_track: { dsa: 10 },
          items_done: 0,
          completed: false,
          version: 1,
          rules_version: RULES_VERSION,
        },
        // Today already has a row (two results): a check-in that did not read today's row too
        // would send it as new (expected 0) and conflict on every attempt.
        {
          user_id: USER_ID,
          local_day: TODAY,
          minutes_by_track: {},
          items_done: 2,
          completed: false,
          version: 2,
          rules_version: RULES_VERSION,
        },
      ],
    })
    expect((await checkInBlock(input({ planId: paused.id, blockId: old.id }))).ok).toBe(true)
    const [call] = learnerCalls(fake)
    expect(learnerCalls(fake)).toHaveLength(1)
    expect(call?.p_expected).toEqual({
      [`plan_block_state:${paused.id}/${old.id}`]: 1,
      [`daily_activity:${YESTERDAY}`]: 1,
      [`daily_activity:${TODAY}`]: 2,
    })
    expect(blockRow(fake, paused.id, old.id)).toMatchObject({
      status: 'done',
      checked_in_on: TODAY,
    })
    expect(dayRow(fake, YESTERDAY)).toMatchObject({ completed: false, minutes_by_track: {} })
    expect(dayRow(fake, TODAY)).toMatchObject({
      completed: true,
      minutes_by_track: { dsa: 10 },
      items_done: 2,
      version: 3,
    })
  })

  it('a skip without minutes records 0 minutes, not the block estimate', async () => {
    const fake = setup({ day_plans: [plan] })
    expect(await checkInBlock(input({ status: 'skipped' }))).toEqual({
      ok: true,
      message: copy.checkIn.checkedIn.skipped,
    })
    expect(learnerCalls(fake)[0]?.p_event.payload).toEqual({ status: 'skipped', minutes: 0 })
    expect(dayRow(fake, TODAY)).toMatchObject({ completed: false, minutes_by_track: { dsa: 0 } })
  })

  it('answers an EventError with its Vietnamese message (quota)', async () => {
    setup({ day_plans: [plan] }, { learner: ['quota_exceeded'] })
    expect(await checkInBlock(input())).toEqual({
      ok: false,
      message: copy.errors.quotaExceeded,
    })
    expect(state.log).toContainEqual(['revalidatePath', '/today'])
  })

  it('lets any other error reach the error boundary', async () => {
    const fake = setup({ day_plans: [plan] })
    fake.failSelect('plan_block_state', 'boom')
    await expect(checkInBlock(input())).rejects.toThrow('Could not read')
  })
})

// ---------------------------------------------------------------------------------------------
// recordOutcome
// ---------------------------------------------------------------------------------------------

describe('recordOutcome', () => {
  const pair = planBlock(TODAY, 'dsa', 'new', ['dsa:p1', 'dsa:p2'])
  const plan = planRow({ date: TODAY, blocks: [pair], seenAt: seen(TODAY) })
  const solved = (change: Partial<OutcomeInput> = {}): OutcomeInput => ({
    requestId: REQUEST_ID,
    itemId: 'dsa:p1',
    outcome: { type: 'item.result', result: 'solved' },
    ...change,
  })
  const autoId = (planId: string, block: PlanBlock, minutes: number) =>
    deriveEventId(REQUEST_ID, `auto:${planId}:${block.id}:${minutes}:${block.items.length}`)

  it('runs the guard first, records the result on the block, and revalidates /today and the item', async () => {
    const fake = setup({ day_plans: [plan] })
    expect(await recordOutcome(solved())).toEqual({
      ok: true,
      message: copy.checkIn.outcome.saved,
      autoCheckedIn: [],
    })
    expect(state.log.slice(0, 2)).toEqual([['requireOnboarded'], ['createClient']])
    expect(learnerCalls(fake)).toMatchObject([
      {
        client: 'session',
        p_event: {
          type: 'item.result',
          item_id: 'dsa:p1',
          track_id: 'dsa',
          plan_id: plan.id,
          block_id: pair.id,
          local_day: TODAY,
          payload: { result: 'solved' },
        },
      },
    ])
    expect(fake.tables.item_state).toMatchObject([
      { item_id: 'dsa:p1', level: 1, last_result: 'solved', last_result_on: TODAY },
    ])
    expect(dayRow(fake, TODAY)).toMatchObject({ items_done: 1, completed: false })
    expect(fake.rpcs('apply_system_event')).toEqual([])
    expect(state.log).toContainEqual(['revalidatePath', '/today'])
    expect(state.log).toContainEqual(['revalidatePath', '/t/dsa/items/p1'])
    expect(state.log).not.toContainEqual(['revalidatePath', '/review'])
  })

  it('reads and writes nothing when the guard redirects', async () => {
    const fake = setup({ day_plans: [plan] })
    state.denied = new Error('REDIRECT:/sign-in')
    await expect(recordOutcome(solved())).rejects.toThrow('REDIRECT:/sign-in')
    expect(state.log).toEqual([['requireOnboarded']])
    expect(fake.calls).toEqual([])
  })

  it('checks in the block its result completes: one auto check-in with its minutes (§5.5)', async () => {
    const fake = setup({ day_plans: [plan], item_state: [handled('dsa:p2')] })
    expect(await recordOutcome(solved())).toEqual({
      ok: true,
      message: copy.checkIn.outcome.savedAndCheckedIn,
      autoCheckedIn: [pair.id],
    })
    const calls = systemCalls(fake)
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({
      client: 'admin',
      p_user_id: USER_ID,
      p_event: {
        id: autoId(plan.id, pair, 20),
        type: 'block.checked_in',
        plan_id: plan.id,
        block_id: pair.id,
        track_id: 'dsa',
        local_day: TODAY,
        payload: { status: 'done', minutes: 20, auto: true },
      },
    })
    expect(blockRow(fake, plan.id, pair.id)).toMatchObject({
      status: 'done',
      minutes: 20,
      auto: true,
      checked_in_on: TODAY,
    })
    expect(dayRow(fake, TODAY)).toMatchObject({
      items_done: 1,
      completed: true,
      minutes_by_track: { dsa: 20 },
    })
  })

  it('checks in nothing after the first item of a block', async () => {
    const fake = setup({ day_plans: [plan] })
    expect((await recordOutcome(solved())).autoCheckedIn).toEqual([])
    expect(fake.rpcs('apply_system_event')).toEqual([])
  })

  it('a skip that finishes the block checks it in too (a skipped item is handled)', async () => {
    const fake = setup({ day_plans: [plan], item_state: [handled('dsa:p2')] })
    const result = await recordOutcome(solved({ outcome: { type: 'item.skipped' } }))
    expect(result.autoCheckedIn).toEqual([pair.id])
    expect(learnerCalls(fake)[0]?.p_event).toMatchObject({ type: 'item.skipped', payload: {} })
    // A skip is not an outcome: it reads and writes no day row itself.
    expect(learnerCalls(fake)[0]?.p_expected).toEqual({ 'item_state:dsa:p1': 0 })
  })

  it('[RF-2] the same input twice: one event id, the duplicate is success, no second auto check-in', async () => {
    const fake = setup({ day_plans: [plan], item_state: [handled('dsa:p2')] })
    const first = await recordOutcome(solved())
    const second = await recordOutcome(solved())
    expect(first.autoCheckedIn).toEqual([pair.id])
    expect(second).toEqual({ ok: true, message: copy.checkIn.outcome.saved, autoCheckedIn: [] })
    const [one, two] = learnerCalls(fake)
    expect(two?.p_event.id).toBe(one?.p_event.id)
    expect(fake.rpcs('apply_system_event')).toHaveLength(1)
    expect(fake.tables.events?.map((row) => row.type)).toEqual(['item.result', 'block.checked_in'])
  })

  it('[RF-2] a version conflict reloads and retries: two attempts, one event', async () => {
    const day = {
      user_id: USER_ID,
      local_day: TODAY,
      minutes_by_track: {},
      items_done: 1,
      completed: false,
      version: 1,
      rules_version: RULES_VERSION,
    } satisfies RowOf<'daily_activity'>
    // Another tab records a result for another item between this request's reads and its write.
    const race: Step = () => {
      const row = state.fake.tables.daily_activity?.[0]
      if (row !== undefined) Object.assign(row, { items_done: 2, version: 2 })
    }
    const fake = setup({ day_plans: [plan], daily_activity: [day] }, { learner: [race] })
    expect((await recordOutcome(solved())).ok).toBe(true)
    const calls = learnerCalls(fake)
    expect(calls).toHaveLength(2)
    expect(calls.map((call) => call.p_expected?.[`daily_activity:${TODAY}`])).toEqual([1, 2])
    expect(fake.tables.events).toHaveLength(1)
    expect(dayRow(fake, TODAY)).toMatchObject({ items_done: 3, version: 3 })
  })

  it('[RF-1] a result at 01:30 in Ho Chi Minh (day start 04:00) counts for the previous date', async () => {
    vi.setSystemTime(new Date('2026-09-28T18:30:00.000Z'))
    const fake = setup({ day_plans: [plan] })
    await recordOutcome(solved())
    expect(learnerCalls(fake)[0]?.p_event.local_day).toBe(TODAY)
    expect(fake.tables.events?.[0]?.local_day).toBe(TODAY)
    expect(fake.tables.item_state?.[0]?.last_result_on).toBe(TODAY)
  })

  it('[RF-1] day_changed retries with the new day', async () => {
    vi.setSystemTime(BEFORE_DAY_START)
    const crossDayStart: Step = () => {
      vi.setSystemTime(AFTER_DAY_START)
    }
    const fake = setup({ day_plans: [plan] }, { learner: [crossDayStart] })
    expect((await recordOutcome(solved())).ok).toBe(true)
    const calls = learnerCalls(fake)
    expect(calls.map((call) => call.p_event.local_day)).toEqual([TODAY, TOMORROW])
    // Still the paused plan's block: on the new day it is the plan /today shows.
    expect(calls[1]?.p_event).toMatchObject({ plan_id: plan.id, block_id: pair.id })
    expect(fake.tables.item_state?.[0]?.last_result_on).toBe(TOMORROW)
    expect(databaseDay(fake, USER_ID)).toBe(TOMORROW)
  })

  describe('which block the result names (decision 14)', () => {
    const review = planBlock(TODAY, 'dsa', 'review', ['dsa:p1'])
    const recap = planBlock(TODAY, 'dsa', 'recap', ['dsa:p3', 'dsa:p1'])
    const other = planBlock(TODAY, 'dsa', 'practice', ['dsa:p4'])
    const twice = planRow({ date: TODAY, blocks: [review, other, recap], seenAt: seen(TODAY) })

    it.each([
      ['the second block when ?block= names it', recap.id, recap.id],
      ['the first block listing the item without ?block=', undefined, review.id],
      ['the first block listing the item when ?block= does not list it', other.id, review.id],
      ['the first block listing the item for an unknown ?block=', 'nope', review.id],
    ])('%s', async (_case, blockId, expected) => {
      const fake = setup({ day_plans: [twice] })
      await recordOutcome(solved(blockId === undefined ? {} : { blockId }))
      expect(learnerCalls(fake)[0]?.p_event).toMatchObject({
        plan_id: twice.id,
        block_id: expected,
      })
    })
  })

  it('records an item in no block of the current plan without a plan (off-plan; 5.4 attaches it)', async () => {
    const fake = setup({ day_plans: [plan] })
    await recordOutcome(solved({ itemId: 'dsa:p5' }))
    const event = learnerCalls(fake)[0]?.p_event
    expect(event).toMatchObject({ type: 'item.result', item_id: 'dsa:p5', local_day: TODAY })
    expect(event).not.toHaveProperty('plan_id')
    expect(event).not.toHaveProperty('block_id')
    expect(fake.rpcs('apply_system_event')).toEqual([])
  })

  it('records a result without a plan before today’s plan exists', async () => {
    const fake = setup({})
    expect((await recordOutcome(solved())).ok).toBe(true)
    expect(learnerCalls(fake)[0]?.p_event).not.toHaveProperty('plan_id')
  })

  it('sends each outcome type as its event and payload', async () => {
    const cases: [OutcomeInput['outcome'], string, string, Record<string, unknown>][] = [
      [
        { type: 'item.result', result: 'hint', mode: 'recall' },
        'dsa:p1',
        'item.result',
        { result: 'hint', mode: 'recall' },
      ],
      [
        { type: 'lesson.completed', quizScore: 80 },
        'dsa:lesson-arrays',
        'lesson.completed',
        { quizScore: 80 },
      ],
      [
        { type: 'exercise.submitted', kind: 'fill-blank', grade: 'close' },
        'english:ex-w1-a',
        'exercise.submitted',
        { kind: 'fill-blank', grade: 'close' },
      ],
      [
        { type: 'prompt.completed', selfRating: 3 },
        'english:prompt-w1',
        'prompt.completed',
        { selfRating: 3 },
      ],
    ]
    for (const [outcome, itemId, type, payload] of cases) {
      const fake = setup({})
      expect((await recordOutcome(solved({ itemId, outcome }))).ok).toBe(true)
      expect(learnerCalls(fake)[0]?.p_event).toMatchObject({ type, item_id: itemId, payload })
    }
  })

  it('re-adds a mastered item (item.readded) without reading the day', async () => {
    const mastered = itemStateRow(
      itemState('dsa:p1', YESTERDAY, {
        level: 3,
        status: 'mastered',
        dueOn: null,
        topSuccesses: 2,
      }),
    )
    const fake = setup({ item_state: [mastered] })
    expect((await recordOutcome(solved({ outcome: { type: 'item.readded' } }))).ok).toBe(true)
    expect(learnerCalls(fake)[0]?.p_expected).toEqual({ 'item_state:dsa:p1': 1 })
    expect(fake.selects('daily_activity')).toEqual([])
  })

  it('refuses an outcome the item cannot take (a lesson completion for a problem), writing nothing', async () => {
    const fake = setup({ day_plans: [plan] })
    expect(await recordOutcome(solved({ outcome: { type: 'lesson.completed' } }))).toEqual({
      ok: false,
      message: copy.checkIn.errors.invalid,
      autoCheckedIn: [],
    })
    expect(fake.rpcs()).toEqual([])
  })

  it('refuses an item the catalog does not have, reading nothing', async () => {
    const fake = setup({ day_plans: [plan] })
    expect(await recordOutcome(solved({ itemId: 'dsa:nope' }))).toEqual({
      ok: false,
      message: copy.checkIn.errors.unknownItem,
      autoCheckedIn: [],
    })
    expect(fake.calls).toEqual([])
  })

  it('refuses an invalid input, reading nothing', async () => {
    const fake = setup({ day_plans: [plan] })
    const bad = solved({ outcome: { type: 'item.result', result: 'perfect' } as never })
    expect(await recordOutcome(bad)).toEqual({
      ok: false,
      message: copy.checkIn.errors.invalid,
      autoCheckedIn: [],
    })
    expect(fake.calls).toEqual([])
  })

  it('answers a quota error with its Vietnamese message', async () => {
    setup({ day_plans: [plan] }, { learner: ['quota_exceeded'] })
    expect(await recordOutcome(solved())).toEqual({
      ok: false,
      message: copy.errors.quotaExceeded,
      autoCheckedIn: [],
    })
  })

  it('[RF-2] the auto check-in racing the sheet: the learner’s check-in lands first and stays', async () => {
    // Between the auto check-in's reads and its write, the learner's sheet checks the block in
    // `partial`: the write conflicts, and the retry — on the reloaded rows — writes nothing.
    const sheet: Step = () => {
      state.fake.tables.plan_block_state?.push({
        ...blockStateRow(plan, pair, 'partial', TODAY),
        minutes: 12,
      })
    }
    const fake = setup(
      { day_plans: [plan], item_state: [handled('dsa:p2')], plan_block_state: [] },
      { system: [sheet] },
    )
    expect(await recordOutcome(solved())).toEqual({
      ok: true,
      message: copy.checkIn.outcome.saved,
      autoCheckedIn: [],
    })
    expect(fake.rpcs('apply_system_event')).toHaveLength(1)
    expect(blockRow(fake, plan.id, pair.id)).toMatchObject({
      status: 'partial',
      minutes: 12,
      auto: false,
    })
  })

  it('[RF-2] the auto check-in sees a learner check-in that landed after the plan was read', async () => {
    // The sheet's `partial` lands while the auto check-in reads the item states: after
    // currentPlan read the block states (no check-in yet), before the block's rows are loaded for
    // the write. The pick is decided again on those rows, so the learner's check-in stays.
    const fake = setup({ day_plans: [plan], item_state: [handled('dsa:p2')], plan_block_state: [] })
    state.onLoadItemStates = () => {
      state.onLoadItemStates = null
      state.fake.tables.plan_block_state?.push({
        ...blockStateRow(plan, pair, 'partial', TODAY),
        minutes: 12,
      })
    }
    expect(await recordOutcome(solved())).toEqual({
      ok: true,
      message: copy.checkIn.outcome.saved,
      autoCheckedIn: [],
    })
    expect(fake.rpcs('apply_system_event')).toEqual([])
    expect(blockRow(fake, plan.id, pair.id)).toMatchObject({
      status: 'partial',
      minutes: 12,
      auto: false,
      version: 1,
    })
  })

  it('checks the extra block in again after it grew; the auto key follows its minutes and items', async () => {
    const small = planBlock(TODAY, 'dsa', 'extra', ['dsa:p1'])
    const grown = planBlock(TODAY, 'dsa', 'extra', ['dsa:p1', 'dsa:p2'])
    const extraPlan = planRow({ date: TODAY, blocks: [small], seenAt: seen(TODAY) })
    const fake = setup({ day_plans: [extraPlan] })
    // p1 finishes the one-item extra block: auto check-in for 10 minutes, 1 item.
    expect((await recordOutcome(solved())).autoCheckedIn).toEqual([small.id])
    // "Học thêm" appends p2 (plan.extra_added); p2's result checks the block in again.
    const row = fake.tables.day_plans?.[0]
    if (row !== undefined) Object.assign(row, { blocks: [grown], version: 2 })
    expect((await recordOutcome(solved({ itemId: 'dsa:p2' }))).autoCheckedIn).toEqual([grown.id])

    const ids = systemCalls(fake).map((call) => call.p_event.id)
    expect(ids).toEqual([autoId(extraPlan.id, small, 10), autoId(extraPlan.id, grown, 20)])
    expect(ids[0]).not.toBe(ids[1])
    expect(blockRow(fake, extraPlan.id, grown.id)).toMatchObject({
      minutes: 20,
      auto: true,
      version: 2,
    })
    expect(dayRow(fake, TODAY)).toMatchObject({ minutes_by_track: { dsa: 20 }, items_done: 2 })
  })

  it('checks nothing in when the plan is no longer current for the auto check-in', async () => {
    vi.setSystemTime(BEFORE_DAY_START)
    const other = planBlock(TODAY, 'english', 'review', ['english:e1'])
    const both = planRow({ date: TODAY, blocks: [pair, other], seenAt: seen(TODAY) })
    // The day starts after the result: the English block is done, so on the new day the gate is
    // open and the plan is not the one /today shows.
    const crossDayStart: Step = () => {
      vi.setSystemTime(AFTER_DAY_START)
    }
    const fake = setup(
      {
        day_plans: [both],
        item_state: [handled('dsa:p2')],
        plan_block_state: [blockStateRow(both, other, 'done', TODAY)],
      },
      { system: [crossDayStart] },
    )
    expect(await recordOutcome(solved())).toEqual({
      ok: true,
      message: copy.checkIn.outcome.saved,
      autoCheckedIn: [],
    })
    expect(fake.rpcs('apply_system_event')).toHaveLength(1)
    expect(blockRow(fake, both.id, pair.id)).toBeUndefined()
  })

  it('checks nothing in on another plan: "Học tiếp hôm nay" in another tab replaced the paused plan', async () => {
    const old = planBlock(YESTERDAY, 'dsa', 'new', ['dsa:p1', 'dsa:p2'])
    const paused = planRow({ date: YESTERDAY, blocks: [old], seenAt: seen(YESTERDAY) })
    const resumed = planBlock(TODAY, 'dsa', 'new', ['dsa:p1', 'dsa:p2'])
    const resumePlan = planRow({ date: TODAY, blocks: [resumed] })
    // The result is recorded on the paused plan's block; meanwhile the other tab builds today's
    // plan from the same unfinished items, so the plan /today shows is no longer the paused one.
    const otherTab: Step = () => {
      state.fake.tables.day_plans?.push(resumePlan)
    }
    const fake = setup(
      { day_plans: [paused], item_state: [handled('dsa:p2')] },
      { learner: [otherTab] },
    )
    expect(await recordOutcome(solved())).toEqual({
      ok: true,
      message: copy.checkIn.outcome.saved,
      autoCheckedIn: [],
    })
    expect(learnerCalls(fake)[0]?.p_event).toMatchObject({ plan_id: paused.id, block_id: old.id })
    expect(fake.rpcs('apply_system_event')).toEqual([])
  })

  it('keeps the saved result when the auto check-in fails, and logs the error', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const fake = setup(
        { day_plans: [plan], item_state: [handled('dsa:p2')] },
        { system: ['invalid_event'] },
      )
      expect(await recordOutcome(solved())).toEqual({
        ok: true,
        message: copy.checkIn.outcome.savedAutoCheckInFailed,
        autoCheckedIn: [],
      })
      expect(fake.tables.events?.map((row) => row.type)).toEqual(['item.result'])
      expect(logged).toHaveBeenCalledWith(
        '[checkin] auto check-in failed:',
        'EventError: invalid_event',
      )
    } finally {
      logged.mockRestore()
    }
  })
})
