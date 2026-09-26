import { describe, expect, it } from 'vitest'
import { CATALOG, itemState } from '@/lib/domain/plan/__tests__/fixtures'
import type { PlanBlock } from '@/lib/domain/plan/types'
import { project, type DomainEvent } from '@/lib/domain/projection/project'
import { RULES_VERSION } from '@/lib/domain/rules'
import { blockKey, type CheckInStatus } from '@/lib/domain/state'
import type { LocalDay } from '@/lib/domain/time/localDay'
import {
  blockStateRow,
  itemStateRow,
  OTHER_USER_ID,
  planBlock,
  planRow,
  TODAY,
  USER_ID,
  YESTERDAY,
} from '@/lib/plans/__tests__/fixtures'
import { createFakeSupabase, type FakeRows, type RowOf } from '@/lib/testing/fake-supabase'
import { derivedStateFromRows, derivedWrite } from './derived'
import { loadDerivedFor, type DerivedLoad } from './load-derived'

const TWO_DAYS_AGO: LocalDay = '2026-09-26'

function dayRow(
  localDay: LocalDay,
  change: Partial<RowOf<'daily_activity'>> = {},
): RowOf<'daily_activity'> {
  return {
    user_id: USER_ID,
    local_day: localDay,
    minutes_by_track: {},
    items_done: 0,
    completed: false,
    version: 1,
    rules_version: RULES_VERSION,
    ...change,
  }
}

/** The loader over `rows`, and the reads it made (table, filters, single, order, range). */
async function load(rows: FakeRows, request: DerivedLoad) {
  const fake = createFakeSupabase(rows)
  const loaded = await loadDerivedFor(fake.client('session'), USER_ID, request)
  const reads = fake.selects().map(({ table, filters, single, order, range }) => ({
    table,
    filters,
    single,
    order,
    range,
  }))
  expect(fake.rpcs()).toEqual([])
  return { ...loaded, reads }
}

const PAGE = [0, 999] as const

describe('loadDerivedFor: item outcomes (ADR-0007)', () => {
  const p1 = itemStateRow(itemState('dsa:p1', YESTERDAY))
  const rows: FakeRows = {
    item_state: [
      p1,
      itemStateRow(itemState('dsa:p2', YESTERDAY)),
      itemStateRow(itemState('dsa:p1', YESTERDAY), OTHER_USER_ID),
    ],
    daily_activity: [
      dayRow(TODAY, { items_done: 2, version: 4 }),
      dayRow(YESTERDAY),
      dayRow(TODAY, { user_id: OTHER_USER_ID }),
    ],
  }

  it("reads the item's row and the day's row, nothing else", async () => {
    const loaded = await load(rows, {
      kind: 'item',
      itemId: 'dsa:p1',
      localDay: TODAY,
      outcome: true,
    })
    expect(loaded.reads).toEqual([
      {
        table: 'item_state',
        filters: [
          { op: 'eq', column: 'user_id', value: USER_ID },
          { op: 'eq', column: 'item_id', value: 'dsa:p1' },
        ],
        single: 'maybeSingle',
        order: [],
        range: null,
      },
      {
        table: 'daily_activity',
        filters: [
          { op: 'eq', column: 'user_id', value: USER_ID },
          { op: 'in', column: 'local_day', value: [TODAY] },
        ],
        single: null,
        order: [{ column: 'local_day', ascending: true }],
        range: null,
      },
    ])
    expect(Object.keys(loaded.state.items)).toEqual(['dsa:p1'])
    expect(loaded.state.blocks).toEqual({})
    expect(Object.keys(loaded.state.days)).toEqual([TODAY])
    expect(loaded.versions).toEqual({
      items: { 'dsa:p1': 1 },
      blocks: {},
      days: { [TODAY]: 4 },
    })
  })

  it('reads only the item row for a skip or re-add (outcome: false)', async () => {
    const loaded = await load(rows, {
      kind: 'item',
      itemId: 'dsa:p1',
      localDay: TODAY,
      outcome: false,
    })
    expect(loaded.reads.map((read) => read.table)).toEqual(['item_state'])
    expect(loaded.state).toEqual(derivedStateFromRows({ items: [p1], blocks: [], days: [] }).state)
    expect(loaded.state.days).toEqual({})
  })

  it('gives an empty state for an item and a day with no rows yet (sent as new, expected 0)', async () => {
    const loaded = await load(
      {},
      { kind: 'item', itemId: 'dsa:p1', localDay: TODAY, outcome: true },
    )
    expect(loaded.state).toEqual({ items: {}, blocks: {}, days: {} })
    expect(loaded.versions).toEqual({ items: {}, blocks: {}, days: {} })
  })

  it('throws when a read fails', async () => {
    const fake = createFakeSupabase(rows)
    fake.failSelect('daily_activity', 'boom')
    await expect(
      loadDerivedFor(fake.client(), USER_ID, {
        kind: 'item',
        itemId: 'dsa:p1',
        localDay: TODAY,
        outcome: true,
      }),
    ).rejects.toThrow('Could not read')
  })
})

/** A check-in event for `load`'s block, as the action projects it. */
function checkInEvent(
  request: Extract<DerivedLoad, { kind: 'block' }>,
  trackId: string,
  minutes: number,
): DomainEvent {
  return {
    id: 'e-1',
    type: 'block.checked_in',
    occurredAt: `${request.localDay}T05:00:00.000Z`,
    localDay: request.localDay,
    trackId,
    itemId: null,
    planId: request.planId,
    blockId: request.blockId,
    payload: { status: request.status, minutes },
    rulesVersion: RULES_VERSION,
  }
}

const blockRead = (planId: string, blockId: string) => ({
  table: 'plan_block_state',
  filters: [
    { op: 'eq', column: 'user_id', value: USER_ID },
    { op: 'eq', column: 'plan_id', value: planId },
    { op: 'eq', column: 'block_id', value: blockId },
  ],
  single: 'maybeSingle',
  order: [],
  range: null,
})
const dayBlocksRead = (days: readonly LocalDay[], range: readonly [number, number] = PAGE) => ({
  table: 'plan_block_state',
  filters: [
    { op: 'eq', column: 'user_id', value: USER_ID },
    { op: 'in', column: 'checked_in_on', value: days },
  ],
  single: null,
  order: [
    { column: 'plan_id', ascending: true },
    { column: 'block_id', ascending: true },
  ],
  range,
})
const daysRead = (days: readonly LocalDay[]) => ({
  table: 'daily_activity',
  filters: [
    { op: 'eq', column: 'user_id', value: USER_ID },
    { op: 'in', column: 'local_day', value: days },
  ],
  single: null,
  order: [{ column: 'local_day', ascending: true }],
  range: null,
})

describe('loadDerivedFor: check-ins (ADR-0007, final review I-1)', () => {
  it("reads a new check-in's row, every block of the user counted today (all plans) and today's row", async () => {
    const block = planBlock(TODAY, 'dsa', 'new', ['dsa:p1'])
    const plan = planRow({ date: TODAY, blocks: [block] })
    const other = planBlock(TODAY, 'english', 'review', ['english:e1'])
    const olderPlan = planRow({ date: YESTERDAY, blocks: [other] })
    const counted = blockStateRow(olderPlan, other, 'done', TODAY)
    const loaded = await load(
      {
        plan_block_state: [
          counted,
          blockStateRow(olderPlan, planBlock(YESTERDAY, 'dsa', 'new', []), 'done', YESTERDAY),
          { ...blockStateRow(plan, block, 'done', TODAY), user_id: OTHER_USER_ID },
        ],
        daily_activity: [dayRow(TODAY, { version: 2 }), dayRow(YESTERDAY)],
      },
      { kind: 'block', planId: plan.id, blockId: block.id, localDay: TODAY, status: 'done' },
    )
    expect(loaded.reads).toEqual([
      blockRead(plan.id, block.id),
      dayBlocksRead([TODAY]),
      daysRead([TODAY]),
    ])
    expect(Object.keys(loaded.state.blocks)).toEqual([blockKey(olderPlan.id, other.id)])
    expect(loaded.versions.days).toEqual({ [TODAY]: 2 })
  })

  describe('two plans checked in on the same day (I-1)', () => {
    // Yesterday's paused plan P1: its block b1 was checked in done today (the resume). Today's
    // "Học tiếp" plan P2: its block c1, checked in earlier today, is now checked in skipped.
    const b1 = planBlock(YESTERDAY, 'dsa', 'new', ['dsa:p1'])
    const c1 = planBlock(TODAY, 'english', 'review', ['english:e1'])
    const p1 = planRow({ date: YESTERDAY, blocks: [b1], seenAt: `${YESTERDAY}T03:00:00.000Z` })
    const p2 = planRow({ date: TODAY, blocks: [c1] })
    const b1Row = blockStateRow(p1, b1, 'done', TODAY)
    const c1Row = blockStateRow(p2, c1, 'done', TODAY)
    const today = dayRow(TODAY, {
      minutes_by_track: { dsa: b1.estMinutes, english: c1.estMinutes },
      completed: true,
      version: 2,
    })
    const request = {
      kind: 'block',
      planId: p2.id,
      blockId: c1.id,
      localDay: TODAY,
      status: 'skipped',
    } as const
    const rows: FakeRows = {
      plan_block_state: [b1Row, c1Row],
      daily_activity: [today],
    }

    it("loads b1 and c1, so today's completed stays true", async () => {
      const loaded = await load(rows, request)
      expect(Object.keys(loaded.state.blocks).sort()).toEqual(
        [blockKey(p1.id, b1.id), blockKey(p2.id, c1.id)].sort(),
      )
      const after = project(loaded.state, checkInEvent(request, 'english', 0), CATALOG)
      const write = derivedWrite(loaded.state, after, loaded.versions)
      expect(write.expected).toEqual({
        [`plan_block_state:${p2.id}/${c1.id}`]: 1,
        [`daily_activity:${TODAY}`]: 2,
      })
      expect(write.changes).toContainEqual({
        table: 'daily_activity',
        row: {
          local_day: TODAY,
          minutes_by_track: { dsa: b1.estMinutes, english: 0 },
          items_done: 0,
          completed: true,
        },
      })
    })

    it('(the failure mode ADR-0007 names) a loader that dropped b1 writes completed: false', async () => {
      const loaded = await load(rows, request)
      const dropped = derivedStateFromRows({ items: [], blocks: [c1Row], days: [today] })
      expect(dropped.state.blocks).not.toEqual(loaded.state.blocks)
      const after = project(dropped.state, checkInEvent(request, 'english', 0), CATALOG)
      const write = derivedWrite(dropped.state, after, dropped.versions)
      // The day row's version is right, so the database would accept it: the streak breaks.
      expect(write.expected[`daily_activity:${TODAY}`]).toBe(2)
      expect(write.changes).toContainEqual({
        table: 'daily_activity',
        row: {
          local_day: TODAY,
          minutes_by_track: { english: 0 },
          items_done: 0,
          completed: false,
        },
      })
    })
  })

  it("loads an edited old check-in's first day: its checked_in_on, not the event's day", async () => {
    const block: PlanBlock = planBlock(YESTERDAY, 'dsa', 'new', ['dsa:p1'])
    const plan = planRow({ date: YESTERDAY, blocks: [block] })
    const sibling = planBlock(YESTERDAY, 'english', 'review', ['english:e1'])
    const rows: FakeRows = {
      plan_block_state: [
        blockStateRow(plan, block, 'done', YESTERDAY),
        blockStateRow(plan, sibling, 'partial', YESTERDAY),
      ],
      daily_activity: [dayRow(YESTERDAY, { completed: true, version: 3 }), dayRow(TODAY)],
    }
    const request = {
      kind: 'block',
      planId: plan.id,
      blockId: block.id,
      localDay: TODAY,
      status: 'partial',
    } as const
    const loaded = await load(rows, request)
    expect(loaded.reads).toEqual([
      blockRead(plan.id, block.id),
      dayBlocksRead([YESTERDAY]),
      daysRead([YESTERDAY]),
    ])
    expect(Object.keys(loaded.state.blocks)).toHaveLength(2)
    expect(Object.keys(loaded.state.days)).toEqual([YESTERDAY])
    const after = project(loaded.state, checkInEvent(request, 'dsa', 5), CATALOG)
    expect(Object.keys(derivedWrite(loaded.state, after, loaded.versions).expected)).toEqual([
      `plan_block_state:${plan.id}/${block.id}`,
      `daily_activity:${YESTERDAY}`,
    ])
  })

  describe('M-6 (a): a skipped block checked in done / partial on a later day moves there', () => {
    const block = planBlock(YESTERDAY, 'dsa', 'new', ['dsa:p1'])
    const plan = planRow({ date: YESTERDAY, blocks: [block] })
    const todays = planBlock(TODAY, 'english', 'review', ['english:e1'])
    const todayPlan = planRow({ date: TODAY, blocks: [todays] })
    const rows: FakeRows = {
      plan_block_state: [
        blockStateRow(plan, block, 'skipped', YESTERDAY),
        blockStateRow(todayPlan, todays, 'skipped', TODAY),
        blockStateRow(plan, planBlock(TWO_DAYS_AGO, 'dsa', 'new', []), 'done', TWO_DAYS_AGO),
      ],
      daily_activity: [
        dayRow(YESTERDAY, { minutes_by_track: { dsa: 10 }, version: 2 }),
        dayRow(TODAY, { minutes_by_track: { english: 10 }, version: 5 }),
        dayRow(TWO_DAYS_AGO),
      ],
    }

    it.each(['done', 'partial'] as const)('reads both days for %s', async (status) => {
      const request = {
        kind: 'block',
        planId: plan.id,
        blockId: block.id,
        localDay: TODAY,
        status,
      } as const
      const loaded = await load(rows, request)
      expect(loaded.reads).toEqual([
        blockRead(plan.id, block.id),
        dayBlocksRead([YESTERDAY, TODAY]),
        daysRead([YESTERDAY, TODAY]),
      ])
      expect(Object.keys(loaded.state.blocks).sort()).toEqual(
        [blockKey(plan.id, block.id), blockKey(todayPlan.id, todays.id)].sort(),
      )
      expect(loaded.versions.days).toEqual({ [YESTERDAY]: 2, [TODAY]: 5 })

      const after = project(loaded.state, checkInEvent(request, 'dsa', 10), CATALOG)
      const write = derivedWrite(loaded.state, after, loaded.versions)
      expect(write.expected).toEqual({
        [`plan_block_state:${plan.id}/${block.id}`]: 1,
        [`daily_activity:${YESTERDAY}`]: 2,
        [`daily_activity:${TODAY}`]: 5,
      })
      expect(write.changes).toContainEqual({
        table: 'daily_activity',
        row: {
          local_day: TODAY,
          minutes_by_track: { english: 10, dsa: 10 },
          items_done: 0,
          completed: true,
        },
      })
    })

    it.each<[string, CheckInStatus, LocalDay]>([
      ['a skip kept', 'skipped', TODAY],
      ['a correction on the same day', 'done', YESTERDAY],
    ])('reads one day for %s', async (_case, status, localDay) => {
      const loaded = await load(rows, {
        kind: 'block',
        planId: plan.id,
        blockId: block.id,
        localDay,
        status,
      })
      expect(loaded.reads).toEqual([
        blockRead(plan.id, block.id),
        dayBlocksRead([YESTERDAY]),
        daysRead([YESTERDAY]),
      ])
    })

    it('reads one day when the stored check-in is not a skip', async () => {
      const done = { ...blockStateRow(plan, block, 'partial', YESTERDAY) }
      const loaded = await load(
        { plan_block_state: [done] },
        { kind: 'block', planId: plan.id, blockId: block.id, localDay: TODAY, status: 'done' },
      )
      expect(loaded.reads.slice(1)).toEqual([dayBlocksRead([YESTERDAY]), daysRead([YESTERDAY])])
    })
  })

  it("pages the day's check-ins (PostgREST max_rows): 1001 rows are all loaded", async () => {
    const block = planBlock(TODAY, 'dsa', 'new', ['dsa:p1'])
    const plan = planRow({ date: TODAY, blocks: [block] })
    const many = Array.from({ length: 1001 }, (_, n) =>
      blockStateRow(plan, planBlock(TODAY, 'dsa', 'review', [], { id: `b-${n}` }), 'done', TODAY),
    )
    const loaded = await load(
      { plan_block_state: many },
      { kind: 'block', planId: plan.id, blockId: block.id, localDay: TODAY, status: 'done' },
    )
    expect(Object.keys(loaded.state.blocks)).toHaveLength(1001)
    const pages = loaded.reads.filter((read) => read.table === 'plan_block_state' && read.range)
    expect(pages.map((read) => read.range)).toEqual([PAGE, [1000, 1999]])
  })
})
