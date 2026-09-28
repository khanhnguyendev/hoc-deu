import { redirect } from 'next/navigation'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { itemState } from '@/lib/domain/plan/__tests__/fixtures'
import { dueQueue } from '@/lib/domain/plan/queues'
import type { PlanBlock } from '@/lib/domain/plan/types'
import { RULES_VERSION } from '@/lib/domain/rules'
import type { LocalDay } from '@/lib/domain/time/localDay'
import { deriveEventId } from '@/lib/events/ids'
import { vi as copy } from '@/lib/i18n/vi'
import { gateState } from '@/lib/plans/day'
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
import { checkInKey } from './event-keys'
import type { CheckInInput, OutcomeInput } from './schema'

const state = vi.hoisted(() => ({
  log: [] as unknown[][],
  /** The guard throws this (a redirect) when set. */
  denied: null as Error | null,
  userId: '5b0c61a2-7f5e-4c3b-9a41-2f1d7c8e9a10',
  fake: null as unknown as import('@/lib/testing/fake-supabase').FakeSupabase,
  /** Runs when the auto check-in reads the item states (another request landing then). */
  onLoadItemStates: null as (() => void) | null,
  /** `ensureToday` throws this when set (task 5.4: the off-plan attachment builds today's plan). */
  ensureTodayThrows: null as unknown,
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
vi.mock('@/lib/plans/today', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/plans/today')>()
  return {
    ...real,
    ensureToday: (...args: Parameters<typeof real.ensureToday>) => {
      if (state.ensureTodayThrows !== null) throw state.ensureTodayThrows
      return real.ensureToday(...args)
    },
  }
})
vi.mock('@/lib/plans/catalog', async () => {
  const { CATALOG } = await import('@/lib/domain/plan/__tests__/fixtures')
  return { planCatalog: () => CATALOG }
})

const { checkInBlock, recordOutcome } = await import('./actions')

const REQUEST_ID = '3f2a1b0c-9d8e-4f7a-8b6c-5d4e3f2a1b0c'
const OTHER_REQUEST_ID = '7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f'
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
/** `itemId` skipped without a result ("Bỏ qua mục này" on a new item): handled, not studied. */
const skippedRow = (itemId: string) =>
  itemStateRow(
    itemState(itemId, TODAY, { status: 'skipped', level: 0, lastResult: null, lastResultOn: null }),
  )

beforeEach(() => {
  state.log = []
  state.denied = null
  state.onLoadItemStates = null
  state.ensureTodayThrows = null
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
    planVersion: plan.version,
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

  it('one-tap after a skip records the block less the skipped item (M5-R39 #3), keyed by it', async () => {
    const halves = planBlock(TODAY, 'english', 'review', ['english:e1', 'english:e2'], {
      estMinutes: 3,
      items: [
        { itemId: 'english:e1', mode: 'review', minutes: 1.5 },
        { itemId: 'english:e2', mode: 'review', minutes: 1.5 },
      ],
    })
    const halvesPlan = planRow({ date: TODAY, blocks: [halves], seenAt: seen(TODAY) })
    const fake = setup({ day_plans: [halvesPlan], item_state: [skippedRow('english:e1')] })
    const request = input({ planId: halvesPlan.id, blockId: halves.id })
    expect(await checkInBlock(request)).toMatchObject({ ok: true })
    const [call] = learnerCalls(fake)
    expect(call?.p_event.payload).toEqual({ status: 'done', minutes: 2 })
    expect(call?.p_event.id).toBe(deriveEventId(REQUEST_ID, checkInKey({ ...request, minutes: 2 })))
    expect(call?.p_event.id).not.toBe(
      deriveEventId(REQUEST_ID, checkInKey({ ...request, minutes: 3 })),
    )
    expect(blockRow(fake, halvesPlan.id, halves.id)).toMatchObject({ status: 'done', minutes: 2 })
  })

  it('one-tap on a block whose items were all skipped records done with 0 minutes', async () => {
    const fake = setup({
      day_plans: [plan],
      item_state: [skippedRow('dsa:p1'), skippedRow('dsa:p2')],
    })
    await checkInBlock(input())
    expect(learnerCalls(fake)[0]?.p_event.payload).toEqual({ status: 'done', minutes: 0 })
  })

  it('the sheet (minutes given) and a skip read no item states', async () => {
    const fake = setup({ day_plans: [plan], item_state: [skippedRow('dsa:p1')] })
    await checkInBlock(input({ minutes: 20 }))
    await checkInBlock(input({ status: 'skipped', requestId: OTHER_REQUEST_ID }))
    expect(fake.selects('item_state')).toEqual([])
    expect(learnerCalls(fake).map((call) => call.p_event.payload)).toEqual([
      { status: 'done', minutes: 20 },
      { status: 'skipped', minutes: 0 },
    ])
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

  it('[decision 36] a page rendered at version 1 while an AI plan replaced it (version 2, same block ids): stale, nothing written', async () => {
    const replaced = { ...plan, version: 2, source: 'ai' }
    const fake = setup({ day_plans: [replaced] })
    expect(await checkInBlock(input({ planVersion: 1 }))).toEqual({
      ok: false,
      message: copy.checkIn.errors.stale,
    })
    expect(fake.rpcs()).toEqual([])
    expect(state.log).toContainEqual(['revalidatePath', '/today'])
  })

  it('[decision 36] the rendered version equal to the current one records the check-in', async () => {
    const fake = setup({ day_plans: [{ ...plan, version: 2 }] })
    expect((await checkInBlock(input({ planVersion: 2, minutes: 5 }))).ok).toBe(true)
    expect(learnerCalls(fake)).toHaveLength(1)
  })

  it('refuses an input without the rendered plan version, reading nothing', async () => {
    const rest: Record<string, unknown> = { ...input() }
    delete rest.planVersion
    const fake = setup({ day_plans: [plan] })
    expect((await checkInBlock(rest as CheckInInput)).ok).toBe(false)
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

  it('a skip that finishes a mixed block checks it in with the studied minutes only (M5-R36)', async () => {
    const fake = setup({ day_plans: [plan], item_state: [handled('dsa:p2')] })
    const result = await recordOutcome(solved({ outcome: { type: 'item.skipped' } }))
    expect(result.autoCheckedIn).toEqual([pair.id])
    expect(learnerCalls(fake)[0]?.p_event).toMatchObject({ type: 'item.skipped', payload: {} })
    // A skip is not an outcome: it reads and writes no day row itself.
    expect(learnerCalls(fake)[0]?.p_expected).toEqual({ 'item_state:dsa:p1': 0 })
    // p1 was skipped: only p2's 10 minutes are credited, not the block's 20.
    expect(systemCalls(fake)[0]?.p_event).toMatchObject({
      id: autoId(plan.id, pair, 10),
      payload: { status: 'done', minutes: 10, auto: true },
    })
    expect(blockRow(fake, plan.id, pair.id)).toMatchObject({ minutes: 10, auto: true })
    expect(dayRow(fake, TODAY)).toMatchObject({ completed: true, minutes_by_track: { dsa: 10 } })
  })

  it('an all-skipped block gets no auto check-in: the day stays incomplete (M5-R36)', async () => {
    const fake = setup({ day_plans: [plan], item_state: [skippedRow('dsa:p2')] })
    expect(await recordOutcome(solved({ outcome: { type: 'item.skipped' } }))).toEqual({
      ok: true,
      message: copy.checkIn.outcome.saved,
      autoCheckedIn: [],
    })
    expect(fake.rpcs('apply_system_event')).toEqual([])
    expect(blockRow(fake, plan.id, pair.id)).toBeUndefined()
    expect(dayRow(fake, TODAY)?.completed ?? false).toBe(false)
  })

  it('the paused plan’s only item skipped: no auto check-in, the gate stays closed (M5-R36)', async () => {
    const old = planBlock(YESTERDAY, 'dsa', 'new', ['dsa:p1'])
    const paused = planRow({ date: YESTERDAY, blocks: [old], seenAt: seen(YESTERDAY) })
    const fake = setup({ day_plans: [paused] })
    expect(await recordOutcome(solved({ outcome: { type: 'item.skipped' } }))).toEqual({
      ok: true,
      message: copy.checkIn.outcome.saved,
      autoCheckedIn: [],
    })
    expect(learnerCalls(fake)[0]?.p_event).toMatchObject({ plan_id: paused.id, block_id: old.id })
    expect(fake.rpcs('apply_system_event')).toEqual([])
    expect(fake.tables.plan_block_state ?? []).toEqual([])
    expect(dayRow(fake, TODAY)?.completed ?? false).toBe(false)
    // Not resumed today: the gate is still closed on the paused plan.
    const gate = await gateState(fake.client('session'), USER_ID, TODAY, new Set(['dsa']))
    expect(gate?.kind).toBe('paused')
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

  it('[decision 36] a result graded on /today at version 1 while the plan is now version 2: stale, nothing written', async () => {
    const fake = setup({ day_plans: [{ ...plan, version: 2, source: 'ai' }] })
    expect(
      await recordOutcome(solved({ blockId: pair.id, planId: plan.id, planVersion: 1 })),
    ).toEqual({
      ok: false,
      message: copy.checkIn.errors.stale,
      autoCheckedIn: [],
    })
    expect(fake.rpcs()).toEqual([])
    expect(state.log).toContainEqual(['revalidatePath', '/today'])
  })

  it('[decision 36] a result with the current version records normally', async () => {
    const fake = setup({ day_plans: [{ ...plan, version: 2 }] })
    expect(
      (await recordOutcome(solved({ blockId: pair.id, planId: plan.id, planVersion: 2 }))).ok,
    ).toBe(true)
    expect(learnerCalls(fake)).toHaveLength(1)
  })

  it('[decision 36] the same version of another plan (a stale day-D page, a new AI plan v1 for D+1): stale, no result, no auto check-in', async () => {
    const fake = setup({ day_plans: [plan] })
    const otherDay = '0d6c1b2a-3e4f-4a5b-8c7d-9e0f1a2b3c4d'
    expect(
      await recordOutcome(solved({ blockId: pair.id, planId: otherDay, planVersion: 1 })),
    ).toEqual({ ok: false, message: copy.checkIn.errors.stale, autoCheckedIn: [] })
    expect(fake.rpcs()).toEqual([])
  })

  it('[decision 36] a /today grade across a day start, before the new day’s plan exists: stale', async () => {
    // Yesterday's plan, seen and checked in: after the day start the gate is open and today has
    // no plan yet, so there is no current plan for the rendered one to match.
    const yesterday = planRow({ date: YESTERDAY, blocks: [pair], seenAt: seen(YESTERDAY) })
    vi.setSystemTime(AFTER_DAY_START)
    const fake = setup({
      day_plans: [yesterday],
      plan_block_state: [blockStateRow(yesterday, pair, 'done', YESTERDAY)],
    })
    expect(
      await recordOutcome(solved({ blockId: pair.id, planId: yesterday.id, planVersion: 1 })),
    ).toEqual({ ok: false, message: copy.checkIn.errors.stale, autoCheckedIn: [] })
    expect(fake.rpcs()).toEqual([])
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

  describe('off-plan study (task 5.4, decision 21)', () => {
    const extraId = `${TODAY}:dsa:extra:1`
    const systemTypes = (fake: FakeSupabase) => systemCalls(fake).map((call) => call.p_event.type)
    const extraBlock = (fake: FakeSupabase, planId: string) =>
      (
        fake.tables.day_plans?.find((row) => row.id === planId)?.blocks as unknown as
          PlanBlock[] | undefined
      )?.find((block) => block.kind === 'extra')

    it('attaches an item in no block of the plan to the extra block, records the result there, then checks the block in', async () => {
      const fake = setup({ day_plans: [plan] })
      expect(await recordOutcome(solved({ itemId: 'dsa:p5' }))).toEqual({
        ok: true,
        message: copy.checkIn.outcome.savedAndCheckedIn,
        autoCheckedIn: [extraId],
      })
      // The attachment first (its own key), then the result naming the extra block, then the
      // extra block's auto check-in.
      expect(fake.calls.filter((call) => call.kind === 'rpc').map((call) => call.name)).toEqual([
        'apply_system_event',
        'apply_event',
        'apply_system_event',
      ])
      expect(systemTypes(fake)).toEqual(['plan.extra_added', 'block.checked_in'])
      expect(systemCalls(fake)[0]?.p_event).toMatchObject({
        id: deriveEventId(REQUEST_ID, `offplan:${plan.id}:dsa:p5`),
        plan_id: plan.id,
        track_id: 'dsa',
        local_day: TODAY,
        payload: { itemIds: ['dsa:p5'] },
      })
      expect(extraBlock(fake, plan.id)).toEqual({
        id: extraId,
        trackId: 'dsa',
        kind: 'extra',
        estMinutes: 20,
        items: [{ itemId: 'dsa:p5', mode: 'new', minutes: 20 }],
      })
      expect(learnerCalls(fake)[0]?.p_event).toMatchObject({
        type: 'item.result',
        item_id: 'dsa:p5',
        plan_id: plan.id,
        block_id: extraId,
      })
      expect(blockRow(fake, plan.id, extraId)).toMatchObject({
        status: 'done',
        minutes: 20,
        auto: true,
        checked_in_on: TODAY,
      })
      // Counted once: the extra block's minutes, one item done.
      expect(dayRow(fake, TODAY)).toMatchObject({
        items_done: 1,
        completed: true,
        minutes_by_track: { dsa: 20 },
      })
    })

    it('attaches a recalled problem in recall mode, with its recall minutes', async () => {
      const fake = setup({
        day_plans: [plan],
        item_state: [handled('dsa:p5', '2026-09-20')],
      })
      await recordOutcome(
        solved({
          itemId: 'dsa:p5',
          outcome: { type: 'item.result', result: 'hint', mode: 'recall' },
        }),
      )
      expect(extraBlock(fake, plan.id)?.items).toEqual([
        { itemId: 'dsa:p5', mode: 'recall', minutes: 5 },
      ])
    })

    it('[RF-2] the same off-plan result twice: one attachment, one result, one auto check-in', async () => {
      const fake = setup({ day_plans: [plan] })
      const first = await recordOutcome(solved({ itemId: 'dsa:p5' }))
      const second = await recordOutcome(solved({ itemId: 'dsa:p5' }))
      expect(first.autoCheckedIn).toEqual([extraId])
      expect(second).toEqual({ ok: true, message: copy.checkIn.outcome.saved, autoCheckedIn: [] })
      expect(systemTypes(fake)).toEqual(['plan.extra_added', 'block.checked_in'])
      expect(fake.tables.events?.map((row) => row.type)).toEqual([
        'plan.extra_added',
        'item.result',
        'block.checked_in',
      ])
      expect(extraBlock(fake, plan.id)?.items).toHaveLength(1)
      expect(dayRow(fake, TODAY)).toMatchObject({ items_done: 1, minutes_by_track: { dsa: 20 } })
    })

    it('[RF-5] the gate closed: the paused plan gains a done extra block, which reopens the gate — no plan for today', async () => {
      const old = planBlock(YESTERDAY, 'dsa', 'new', ['dsa:p1'])
      const paused = planRow({ date: YESTERDAY, blocks: [old], seenAt: seen(YESTERDAY) })
      const fake = setup({ day_plans: [paused] })
      const pausedExtra = `${YESTERDAY}:dsa:extra:1`
      expect(await recordOutcome(solved({ itemId: 'dsa:p5' }))).toMatchObject({
        ok: true,
        autoCheckedIn: [pausedExtra],
      })
      expect(learnerCalls(fake)[0]?.p_event).toMatchObject({
        plan_id: paused.id,
        block_id: pausedExtra,
        local_day: TODAY,
      })
      // Checked in done today: the gate is open, resumed today (§5.9).
      expect(blockRow(fake, paused.id, pausedExtra)).toMatchObject({
        status: 'done',
        auto: true,
        checked_in_on: TODAY,
      })
      expect(fake.tables.day_plans?.map((row) => row.plan_date)).toEqual([YESTERDAY])
      // The next result finds the extra block through the resumed plan (still current today).
      await recordOutcome(solved({ itemId: 'dsa:p5', requestId: OTHER_REQUEST_ID }))
      expect(learnerCalls(fake)[1]?.p_event).toMatchObject({
        plan_id: paused.id,
        block_id: pausedExtra,
      })
      expect(fake.tables.day_plans?.map((row) => row.plan_date)).toEqual([YESTERDAY])
    })

    it("builds today's plan first when there is none (ensureToday), then records the result on it", async () => {
      const fake = setup({})
      expect((await recordOutcome(solved({ itemId: 'dsa:p5' }))).ok).toBe(true)
      const today = fake.tables.day_plans?.find((row) => row.plan_date === TODAY)
      expect(today).toBeDefined()
      expect(systemTypes(fake).slice(0, 2)).toEqual(['plan.generated', 'plan.extra_added'])
      expect(learnerCalls(fake)[0]?.p_event).toMatchObject({
        plan_id: today?.id,
        block_id: extraId,
      })
    })

    it('an item the built plan lists is recorded on that block, attaching nothing', async () => {
      const fake = setup({})
      await recordOutcome(solved())
      const today = fake.tables.day_plans?.find((row) => row.plan_date === TODAY)
      const listed = (today?.blocks as unknown as PlanBlock[]).find((block) =>
        block.items.some((item) => item.itemId === 'dsa:p1'),
      )
      expect(listed).toBeDefined()
      expect(systemTypes(fake)).toEqual(['plan.generated'])
      expect(learnerCalls(fake)[0]?.p_event).toMatchObject({
        plan_id: today?.id,
        block_id: listed?.id,
      })
    })

    it('a skip or a re-add off the plan attaches nothing (not study)', async () => {
      const fake = setup({ day_plans: [plan] })
      await recordOutcome(solved({ itemId: 'dsa:p5', outcome: { type: 'item.skipped' } }))
      expect(fake.rpcs('apply_system_event')).toEqual([])
      expect(learnerCalls(fake)[0]?.p_event).not.toHaveProperty('plan_id')
    })

    it('an outcome the item cannot take attaches nothing', async () => {
      const fake = setup({ day_plans: [plan] })
      expect(
        (await recordOutcome(solved({ itemId: 'dsa:p5', outcome: { type: 'lesson.completed' } })))
          .ok,
      ).toBe(false)
      expect(fake.rpcs()).toEqual([])
    })

    it('records the result without a plan when the attachment fails, and logs it', async () => {
      const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
      try {
        const fake = setup({ day_plans: [plan] }, { plans: ['invalid_event'] })
        expect(await recordOutcome(solved({ itemId: 'dsa:p5' }))).toEqual({
          ok: true,
          message: copy.checkIn.outcome.saved,
          autoCheckedIn: [],
        })
        expect(learnerCalls(fake)[0]?.p_event).not.toHaveProperty('plan_id')
        expect(logged).toHaveBeenCalledWith(
          '[checkin] off-plan attachment failed:',
          'EventError: invalid_event',
        )
      } finally {
        logged.mockRestore()
      }
    })

    it('[M-9] the result write conflicts after the attachment: the retry finds the item listed, no second plan.extra_added', async () => {
      const fake = setup({ day_plans: [plan] }, { learner: ['version_conflict'] })
      expect(await recordOutcome(solved({ itemId: 'dsa:p5' }))).toEqual({
        ok: true,
        message: copy.checkIn.outcome.savedAndCheckedIn,
        autoCheckedIn: [extraId],
      })
      expect(systemTypes(fake)).toEqual(['plan.extra_added', 'block.checked_in'])
      const calls = learnerCalls(fake)
      expect(calls).toHaveLength(2)
      expect(calls[1]?.p_event.id).toBe(calls[0]?.p_event.id)
      expect(calls.map((call) => call.p_event.block_id)).toEqual([extraId, extraId])
      expect(extraBlock(fake, plan.id)?.items.map((item) => item.itemId)).toEqual(['dsa:p5'])
      expect(fake.tables.events?.map((row) => row.type)).toEqual([
        'plan.extra_added',
        'item.result',
        'block.checked_in',
      ])
    })

    it('[M-3] an active track: the paused plan’s extra block holds an unfinished item — the result joins it, no auto check-in, the gate stays closed (the paused view lists it)', async () => {
      const old = planBlock(YESTERDAY, 'dsa', 'new', ['dsa:p1'])
      const earlier = planBlock(YESTERDAY, 'dsa', 'extra', ['dsa:p6'])
      const paused = planRow({ date: YESTERDAY, blocks: [old, earlier], seenAt: seen(YESTERDAY) })
      const fake = setup({ day_plans: [paused] })
      expect(await recordOutcome(solved({ itemId: 'dsa:p5' }))).toEqual({
        ok: true,
        message: copy.checkIn.outcome.saved,
        autoCheckedIn: [],
      })
      expect(extraBlock(fake, paused.id)?.items.map((item) => item.itemId)).toEqual([
        'dsa:p6',
        'dsa:p5',
      ])
      expect(fake.tables.plan_block_state ?? []).toEqual([])
      // Still closed: the next result goes to the paused plan again, and no plan is built today.
      await recordOutcome(solved({ itemId: 'dsa:p6', requestId: OTHER_REQUEST_ID }))
      expect(learnerCalls(fake)[1]?.p_event).toMatchObject({
        plan_id: paused.id,
        block_id: `${YESTERDAY}:dsa:extra:1`,
      })
      expect(fake.tables.day_plans?.map((row) => row.plan_date)).toEqual([YESTERDAY])
    })

    it('[M-3, M5-R36] a paused track’s extra block holds an unfinished item: the card goes to a fresh extra block, checked in — the gate reopens', async () => {
      const old = planBlock(YESTERDAY, 'dsa', 'new', ['dsa:p1'])
      const english = planBlock(YESTERDAY, 'english', 'extra', ['english:e1'])
      const paused = planRow({
        date: YESTERDAY,
        blocks: [old, english],
        seenAt: seen(YESTERDAY),
      })
      const fake = setup({
        day_plans: [paused],
        user_tracks: [
          trackRow('dsa', { start_date: '2026-09-01' }),
          trackRow('english', { start_date: '2026-09-01', status: 'paused' }),
        ],
      })
      const fresh = `${YESTERDAY}:english:extra:2`
      const know = { type: 'item.result', result: 'know' } as const
      expect(await recordOutcome(solved({ itemId: 'english:e2', outcome: know }))).toEqual({
        ok: true,
        message: copy.checkIn.outcome.savedAndCheckedIn,
        autoCheckedIn: [fresh],
      })
      expect(learnerCalls(fake)[0]?.p_event).toMatchObject({
        plan_id: paused.id,
        block_id: fresh,
        local_day: TODAY,
      })
      // The hidden extra:1 is untouched; the fresh block's one card counts (1.5 → 2 minutes).
      expect(extraBlock(fake, paused.id)).toEqual(english)
      expect(blockRow(fake, paused.id, english.id)).toBeUndefined()
      expect(blockRow(fake, paused.id, fresh)).toMatchObject({
        status: 'done',
        minutes: 2,
        auto: true,
        checked_in_on: TODAY,
      })
      expect(dayRow(fake, TODAY)).toMatchObject({
        completed: true,
        minutes_by_track: { english: 2 },
      })
      const gate = await gateState(fake.client('session'), USER_ID, TODAY, new Set(['dsa']))
      expect(gate?.kind).toBe('resumed')
    })

    it('[M-2] a plain Error while building today’s plan never loses the result: logged, recorded without a plan', async () => {
      const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
      try {
        const fake = setup({})
        state.ensureTodayThrows = new Error('Could not read the recap history')
        expect(await recordOutcome(solved({ itemId: 'dsa:p5' }))).toEqual({
          ok: true,
          message: copy.checkIn.outcome.saved,
          autoCheckedIn: [],
        })
        expect(learnerCalls(fake)[0]?.p_event).not.toHaveProperty('plan_id')
        expect(fake.tables.day_plans ?? []).toEqual([])
        expect(logged).toHaveBeenCalledWith(
          '[checkin] off-plan attachment failed:',
          'Error: Could not read the recap history',
        )
      } finally {
        logged.mockRestore()
      }
    })

    it('[M-2] Next’s control flow (a redirect) is never swallowed: it passes through, nothing recorded', async () => {
      const fake = setup({})
      let control: unknown = null
      try {
        redirect('/sign-in')
      } catch (error) {
        control = error
      }
      state.ensureTodayThrows = control
      await expect(recordOutcome(solved({ itemId: 'dsa:p5' }))).rejects.toBe(control)
      expect(fake.rpcs('apply_event')).toEqual([])
    })

    it('records a result without a plan when there is none to attach to (no active track)', async () => {
      const fake = createFakeSupabase({
        schedule_versions: [scheduleRow()],
        user_tracks: [trackRow('dsa', { start_date: '2026-09-01', status: 'removed' })],
      })
      eventStore(fake, USER_ID)
      state.fake = fake
      expect((await recordOutcome(solved())).ok).toBe(true)
      expect(learnerCalls(fake)[0]?.p_event).not.toHaveProperty('plan_id')
      expect(fake.rpcs('apply_system_event')).toEqual([])
    })
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

  describe('a custom item (task 6.6a: the per-user catalog overlay, decision 17)', () => {
    const CARD = 'user:0123456789abcdef:ah-card'
    const customCard = (change: Partial<RowOf<'user_items'>> = {}): RowOf<'user_items'> => ({
      user_id: USER_ID,
      item_id: CARD,
      item_type: 'flashcard',
      track_id: 'dsa',
      topic_id: 'arrays',
      payload: { front: 'two pointers', back: 'hai con trỏ', tags: [] },
      status: 'active',
      created_by_run: 'run_2026-09-28',
      created_on: TODAY,
      created_at: '2026-09-28T00:00:00.000Z',
      ...change,
    })
    const know = solved({ itemId: CARD, outcome: { type: 'item.result', result: 'know' } })

    it('grading a custom card creates its item_state (the track’s card SRS), due later in the review queue', async () => {
      const fake = setup({ day_plans: [plan], user_items: [customCard()] })
      expect(await recordOutcome(know)).toMatchObject({ ok: true })
      expect(learnerCalls(fake)[0]?.p_event).toMatchObject({
        type: 'item.result',
        item_id: CARD,
        track_id: 'dsa',
        payload: { result: 'know' },
      })
      // DSA cards recall on [1, 3, 7, 14] (§5.7 srs.byType): due tomorrow.
      expect(fake.tables.item_state).toMatchObject([
        {
          item_id: CARD,
          track_id: 'dsa',
          item_type: 'flashcard',
          topic_id: 'arrays',
          level: 1,
          due_on: TOMORROW,
        },
      ])
      const { readItemStates } = await import('@/lib/plans/reads')
      const { catalogWith } = await import('@/lib/plans/day')
      const { readUserItems } = await import('@/lib/plans/reads')
      const client = fake.client('check')
      const items = await readItemStates(client, USER_ID)
      const catalog = catalogWith(await readUserItems(client, USER_ID))
      const due = (today: LocalDay) =>
        dueQueue({ trackId: 'dsa', items, catalog, today, weakTopicIds: new Set() }).map(
          (entry) => entry.itemId,
        )
      expect(due(TODAY)).not.toContain(CARD)
      expect(due(TOMORROW)).toContain(CARD)
      expect(state.log).toContainEqual([
        'revalidatePath',
        '/t/dsa/items/user%3A0123456789abcdef%3Aah-card',
      ])
    })

    it('studied off the plan, it joins the track’s extra block like any item', async () => {
      const fake = setup({ day_plans: [plan], user_items: [customCard()] })
      await recordOutcome(know)
      expect(systemCalls(fake)[0]?.p_event).toMatchObject({
        type: 'plan.extra_added',
        track_id: 'dsa',
        payload: { itemIds: [CARD] },
      })
      expect(learnerCalls(fake)[0]?.p_event).toMatchObject({ block_id: `${TODAY}:dsa:extra:1` })
    })

    it("another learner's custom item is unknown (RLS: own rows only), reading no plan", async () => {
      const fake = setup({
        day_plans: [plan],
        user_items: [customCard({ user_id: '0f8d6a52-3b1c-4d7e-9a2f-6c5b4e3d2a10' })],
      })
      expect(await recordOutcome(know)).toEqual({
        ok: false,
        message: copy.checkIn.errors.unknownItem,
        autoCheckedIn: [],
      })
      expect(fake.rpcs()).toEqual([])
    })
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

  it('the extra block re-send follows the studied minutes: a skipped addition credits nothing (M5-R36)', async () => {
    const one = planBlock(TODAY, 'dsa', 'extra', ['dsa:p1'])
    const two = planBlock(TODAY, 'dsa', 'extra', ['dsa:p1', 'dsa:p2'])
    const three = planBlock(TODAY, 'dsa', 'extra', ['dsa:p1', 'dsa:p2', 'dsa:p3'])
    const extraPlan = planRow({ date: TODAY, blocks: [one], seenAt: seen(TODAY) })
    const fake = setup({ day_plans: [extraPlan] })
    const grow = (block: PlanBlock, version: number) => {
      const row = fake.tables.day_plans?.[0]
      if (row !== undefined) Object.assign(row, { blocks: [block], version })
    }
    expect((await recordOutcome(solved())).autoCheckedIn).toEqual([one.id])
    // p2 is added, then skipped: the block is complete again, but its studied minutes are still
    // 10 — nothing is re-sent.
    grow(two, 2)
    const skip = { itemId: 'dsa:p2', outcome: { type: 'item.skipped' } } as const
    expect((await recordOutcome(solved(skip))).autoCheckedIn).toEqual([])
    // p3 is added and solved: re-sent with p1's and p3's minutes, 20 — not the block's 30.
    grow(three, 3)
    expect((await recordOutcome(solved({ itemId: 'dsa:p3' }))).autoCheckedIn).toEqual([three.id])

    const ids = systemCalls(fake).map((call) => call.p_event.id)
    expect(ids).toEqual([autoId(extraPlan.id, one, 10), autoId(extraPlan.id, three, 20)])
    expect(blockRow(fake, extraPlan.id, three.id)).toMatchObject({ minutes: 20, auto: true })
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
