import { describe, expect, it } from 'vitest'
import type { PlanCatalog } from '@/lib/domain/catalog'
import { project, type DomainEvent } from '@/lib/domain/projection/project'
import { RULES_VERSION } from '@/lib/domain/rules'
import {
  blockKey,
  EMPTY_DERIVED_STATE,
  type BlockState,
  type DailyActivity,
  type DerivedState,
  type ItemState,
} from '@/lib/domain/state'
import {
  blockStateFromRow,
  dailyActivityFromRow,
  derivedStateFromRows,
  derivedWrite,
  itemStateFromRow,
  NO_VERSIONS,
  type BlockStateRow,
  type DailyActivityRow,
  type ItemStateRow,
  type VersionMap,
} from './derived'

const USER_ID = '7d4c2b1a-3e5f-4a6b-8c9d-0e1f2a3b4c5d'
const PLAN_ID = '9f8e7d6c-5b4a-4c3d-8e2f-1a0b9c8d7e6f'
const DAY = '2026-09-28'
const NEXT_DAY = '2026-09-29'

/** Deep-freezes a fixture, so a function that mutates its input fails the test. */
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const entry of Object.values(value)) deepFreeze(entry)
    Object.freeze(value)
  }
  return value
}

const item = (itemId: string, change: Partial<ItemState> = {}): ItemState => ({
  itemId,
  trackId: 'dsa',
  topicId: 'arrays',
  itemType: 'problem',
  level: 1,
  weak: false,
  topSuccesses: 0,
  status: 'ok',
  dueOn: '2026-10-05',
  lastResult: 'solved',
  lastResultOn: DAY,
  introducedOn: DAY,
  lapses: 0,
  reps: 1,
  ...change,
})

const block = (blockId: string, change: Partial<BlockState> = {}): BlockState => ({
  planId: PLAN_ID,
  blockId,
  trackId: 'dsa',
  status: 'done',
  minutes: 30,
  note: null,
  auto: false,
  checkedInOn: DAY,
  ...change,
})

const day = (localDay: string, change: Partial<DailyActivity> = {}): DailyActivity => ({
  localDay,
  minutesByTrack: { dsa: 30 },
  itemsDone: 1,
  completed: true,
  ...change,
})

const stateOf = (
  items: readonly ItemState[],
  blocks: readonly BlockState[],
  days: readonly DailyActivity[],
): DerivedState =>
  deepFreeze({
    items: Object.fromEntries(items.map((row) => [row.itemId, row])),
    blocks: Object.fromEntries(blocks.map((row) => [blockKey(row.planId, row.blockId), row])),
    days: Object.fromEntries(days.map((row) => [row.localDay, row])),
  })

/** The snake_case row `derivedWrite` sends for `item`. */
const itemRow = (state: ItemState) => ({
  item_id: state.itemId,
  track_id: state.trackId,
  topic_id: state.topicId,
  item_type: state.itemType,
  level: state.level,
  weak: state.weak,
  top_successes: state.topSuccesses,
  status: state.status,
  due_on: state.dueOn,
  last_result: state.lastResult,
  last_result_on: state.lastResultOn,
  introduced_on: state.introducedOn,
  lapses: state.lapses,
  reps: state.reps,
})

describe('NO_VERSIONS', () => {
  it('is empty for all three tables', () => {
    expect(NO_VERSIONS).toEqual({ items: {}, blocks: {}, days: {} })
  })
})

describe('derivedWrite', () => {
  const before = stateOf(
    [item('dsa:p1'), item('dsa:p2', { status: 'weak', weak: true })],
    [block('b-review')],
    [day(DAY)],
  )
  const versions: VersionMap = deepFreeze({
    items: { 'dsa:p1': 3, 'dsa:p2': 1 },
    blocks: { [blockKey(PLAN_ID, 'b-review')]: 2 },
    days: { [DAY]: 4 },
  })

  it('sends nothing when nothing changed (deep equality, not identity)', () => {
    const copy = stateOf(
      [item('dsa:p1'), item('dsa:p2', { status: 'weak', weak: true })],
      [block('b-review')],
      [day(DAY, { minutesByTrack: { dsa: 30 } })],
    )
    expect(copy).not.toBe(before)
    expect(derivedWrite(before, copy, versions)).toEqual({ changes: [], expected: {} })
  })

  it('sends only the changed item_state rows, snake_case, with their current version', () => {
    const changed = item('dsa:p1', { level: 2, dueOn: '2026-10-19', reps: 2 })
    const after = stateOf(
      [changed, item('dsa:p2', { status: 'weak', weak: true })],
      [block('b-review')],
      [day(DAY)],
    )
    expect(derivedWrite(before, after, versions)).toEqual({
      changes: [{ table: 'item_state', row: itemRow(changed) }],
      expected: { 'item_state:dsa:p1': 3 },
    })
  })

  it('sends a new row with expected 0, keyed as apply_derived_changes keys it', () => {
    const newItem = item('dsa:p3', { topicId: null, dueOn: null, lastResult: null })
    const newBlock = block('b-new', { status: 'partial', minutes: 10, note: 'Ôn lại', auto: true })
    const newDay = day(NEXT_DAY, { minutesByTrack: { dsa: 10, english: 5 }, completed: false })
    const after = stateOf(
      [item('dsa:p1'), item('dsa:p2', { status: 'weak', weak: true }), newItem],
      [block('b-review'), newBlock],
      [day(DAY), newDay],
    )
    expect(derivedWrite(before, after, versions)).toEqual({
      changes: [
        { table: 'item_state', row: itemRow(newItem) },
        {
          table: 'plan_block_state',
          row: {
            plan_id: PLAN_ID,
            block_id: 'b-new',
            track_id: 'dsa',
            status: 'partial',
            minutes: 10,
            note: 'Ôn lại',
            auto: true,
            checked_in_on: DAY,
          },
        },
        {
          table: 'daily_activity',
          row: {
            local_day: NEXT_DAY,
            minutes_by_track: { dsa: 10, english: 5 },
            items_done: 1,
            completed: false,
          },
        },
      ],
      expected: {
        'item_state:dsa:p3': 0,
        [`plan_block_state:${PLAN_ID}/b-new`]: 0,
        [`daily_activity:${NEXT_DAY}`]: 0,
      },
    })
  })

  it('sends a changed check-in and its day with their versions', () => {
    const after = stateOf(
      [item('dsa:p1'), item('dsa:p2', { status: 'weak', weak: true })],
      [block('b-review', { status: 'partial', minutes: 20 })],
      [day(DAY, { minutesByTrack: { dsa: 20 } })],
    )
    const write = derivedWrite(before, after, versions)
    expect(write.expected).toEqual({
      [`plan_block_state:${PLAN_ID}/b-review`]: 2,
      [`daily_activity:${DAY}`]: 4,
    })
    expect(write.changes).toEqual([
      {
        table: 'plan_block_state',
        row: expect.objectContaining({ block_id: 'b-review', status: 'partial', minutes: 20 }),
      },
      {
        table: 'daily_activity',
        row: expect.objectContaining({ local_day: DAY, minutes_by_track: { dsa: 20 } }),
      },
    ])
  })

  it('orders the rows by table, then by key', () => {
    const after = stateOf(
      [item('dsa:p2', { status: 'ok' }), item('dsa:p1', { level: 2 })],
      [block('b-review')],
      [day(DAY)],
    )
    const rows = derivedWrite(before, after, versions).changes.map(
      (change) => (change as { row: unknown }).row,
    )
    expect(rows).toEqual([
      expect.objectContaining({ item_id: 'dsa:p1' }),
      expect.objectContaining({ item_id: 'dsa:p2' }),
    ])
  })

  it('reads versions by own key only: an item named constructor is new (0)', () => {
    const after = stateOf([item('constructor')], [], [])
    expect(derivedWrite(EMPTY_DERIVED_STATE, after, NO_VERSIONS).expected).toEqual({
      'item_state:constructor': 0,
    })
  })

  it.each<[string, DerivedState]>([
    [
      'an item_state row',
      stateOf([item('dsa:p2', { status: 'weak', weak: true })], [block('b-review')], [day(DAY)]),
    ],
    [
      'a plan_block_state row',
      stateOf([item('dsa:p1'), item('dsa:p2', { status: 'weak', weak: true })], [], [day(DAY)]),
    ],
    [
      'a daily_activity row',
      stateOf(
        [item('dsa:p1'), item('dsa:p2', { status: 'weak', weak: true })],
        [block('b-review')],
        [],
      ),
    ],
  ])('throws when %s is missing from after (deletions happen only in SQL)', (_name, after) => {
    expect(() => derivedWrite(before, after, versions)).toThrow(/deleted/)
  })
})

const ITEM_ROW: ItemStateRow = {
  user_id: USER_ID,
  item_id: 'dsa:p1',
  track_id: 'dsa',
  topic_id: 'arrays',
  item_type: 'problem',
  level: 2,
  weak: true,
  top_successes: 1,
  status: 'weak',
  due_on: '2026-10-01',
  last_result: 'hint',
  last_result_on: DAY,
  introduced_on: '2026-09-20',
  lapses: 1,
  reps: 3,
  version: 5,
  rules_version: 2,
}

const BLOCK_ROW: BlockStateRow = {
  plan_id: PLAN_ID,
  block_id: 'b-review',
  user_id: USER_ID,
  track_id: 'dsa',
  status: 'partial',
  minutes: 15,
  note: 'Ôn lại',
  auto: false,
  checked_in_on: DAY,
  checked_in_at: '2026-09-28T03:00:00+00:00',
  version: 2,
  rules_version: 2,
}

const DAY_ROW: DailyActivityRow = {
  user_id: USER_ID,
  local_day: DAY,
  minutes_by_track: { dsa: 15, english: 10 },
  items_done: 4,
  completed: true,
  version: 3,
  rules_version: 2,
}

describe('row mappers', () => {
  it('itemStateFromRow maps every column and drops the persistence ones', () => {
    expect(itemStateFromRow(ITEM_ROW)).toEqual({
      itemId: 'dsa:p1',
      trackId: 'dsa',
      topicId: 'arrays',
      itemType: 'problem',
      level: 2,
      weak: true,
      topSuccesses: 1,
      status: 'weak',
      dueOn: '2026-10-01',
      lastResult: 'hint',
      lastResultOn: DAY,
      introducedOn: '2026-09-20',
      lapses: 1,
      reps: 3,
    })
  })

  it('blockStateFromRow maps every column and drops the persistence ones', () => {
    expect(blockStateFromRow(BLOCK_ROW)).toEqual({
      planId: PLAN_ID,
      blockId: 'b-review',
      trackId: 'dsa',
      status: 'partial',
      minutes: 15,
      note: 'Ôn lại',
      auto: false,
      checkedInOn: DAY,
    })
  })

  it('dailyActivityFromRow maps every column and drops the persistence ones', () => {
    expect(dailyActivityFromRow(DAY_ROW)).toEqual({
      localDay: DAY,
      minutesByTrack: { dsa: 15, english: 10 },
      itemsDone: 4,
      completed: true,
    })
  })

  it.each([
    ['a string value', { dsa: '15' }],
    ['an array', [15]],
    ['null', null],
    ['a number', 15],
  ])('reads a malformed minutes_by_track (%s) as {}', (_name, minutes) => {
    expect(dailyActivityFromRow({ ...DAY_ROW, minutes_by_track: minutes }).minutesByTrack).toEqual(
      {},
    )
  })

  it('rejects a status the database would never hold', () => {
    expect(() => itemStateFromRow({ ...ITEM_ROW, status: 'perfect' })).toThrow(/status/)
    expect(() => blockStateFromRow({ ...BLOCK_ROW, status: 'perfect' })).toThrow(/status/)
  })
})

describe('derivedStateFromRows', () => {
  const rows = deepFreeze({
    items: [ITEM_ROW, { ...ITEM_ROW, item_id: 'dsa:p2', status: 'ok', weak: false, version: 1 }],
    blocks: [BLOCK_ROW],
    days: [DAY_ROW],
  })

  it('builds the state and collects every version', () => {
    const { state, versions } = derivedStateFromRows(rows)
    expect(Object.keys(state.items)).toEqual(['dsa:p1', 'dsa:p2'])
    expect(state.blocks[blockKey(PLAN_ID, 'b-review')]).toEqual(blockStateFromRow(BLOCK_ROW))
    expect(state.days[DAY]).toEqual(dailyActivityFromRow(DAY_ROW))
    expect(versions).toEqual({
      items: { 'dsa:p1': 5, 'dsa:p2': 1 },
      blocks: { [blockKey(PLAN_ID, 'b-review')]: 2 },
      days: { [DAY]: 3 },
    })
  })

  it('round-trips: the rows derivedWrite sends for the whole state are the rows read', () => {
    const { state } = derivedStateFromRows(rows)
    const persistence = new Set(['user_id', 'version', 'rules_version', 'checked_in_at'])
    const withoutPersistence = (row: object) =>
      Object.fromEntries(Object.entries(row).filter(([key]) => !persistence.has(key)))
    expect(derivedWrite(EMPTY_DERIVED_STATE, state, NO_VERSIONS).changes).toEqual([
      ...rows.items.map((row) => ({ table: 'item_state', row: withoutPersistence(row) })),
      ...rows.blocks.map((row) => ({ table: 'plan_block_state', row: withoutPersistence(row) })),
      ...rows.days.map((row) => ({ table: 'daily_activity', row: withoutPersistence(row) })),
    ])
  })

  it('gives an empty state and NO_VERSIONS for no rows', () => {
    expect(derivedStateFromRows({ items: [], blocks: [], days: [] })).toEqual({
      state: EMPTY_DERIVED_STATE,
      versions: NO_VERSIONS,
    })
  })
})

/**
 * The loader contract (final review I-1; `derivedWrite`'s doc, ADR-0007 "Loading derived state"):
 * `project` recomputes a day's `minutes_by_track` and `completed` from every block in `before`
 * counted for that day. A caller that loads only the block being checked in overwrites the day
 * from a partial set, and the day row's version is right, so the database accepts the write.
 */
describe('loading derived state for block.checked_in (the loader contract)', () => {
  const NO_CATALOG: PlanCatalog = deepFreeze({ tracks: {}, items: {}, decks: {} })
  // Yesterday's paused plan (A) and today's "Học tiếp" plan (B), both counted for DAY.
  const PLAN_A = '1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e'
  const PLAN_B = '2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f'
  const BLOCK_B = `${DAY}:english:new:1`

  /** Plan A's DSA block, checked in done on DAY; the day row says the day is completed. */
  const DONE_A: BlockStateRow = deepFreeze({
    ...BLOCK_ROW,
    plan_id: PLAN_A,
    block_id: `${DAY}:dsa:review:1`,
    status: 'done',
    minutes: 30,
    note: null,
    checked_in_on: DAY,
    version: 1,
  })
  const COMPLETED_DAY: DailyActivityRow = deepFreeze({
    ...DAY_ROW,
    minutes_by_track: { dsa: 30 },
    items_done: 0,
    completed: true,
    version: 1,
  })

  const checkIn = (fields: Partial<DomainEvent>): DomainEvent =>
    deepFreeze({
      id: 'e-001',
      type: 'block.checked_in',
      occurredAt: '2026-09-28T10:00:00.000Z',
      localDay: DAY,
      trackId: 'english',
      itemId: null,
      planId: PLAN_B,
      blockId: BLOCK_B,
      payload: { status: 'skipped', minutes: 0 },
      rulesVersion: RULES_VERSION,
      ...fields,
    })

  /** Loads `rows`, projects `event` and returns the derived write, as M5's action will. */
  const writeFor = (rows: Parameters<typeof derivedStateFromRows>[0], event: DomainEvent) => {
    const { state, versions } = derivedStateFromRows(rows)
    return derivedWrite(state, project(state, event, NO_CATALOG), versions)
  }

  it("keeps the day completed when a second plan's block is skipped: every block of the day is loaded", () => {
    // Loaded: plan B's block row (none yet), every plan_block_state row of the user with
    // checked_in_on = DAY (plan A's done block), and DAY's daily_activity row.
    const write = writeFor({ items: [], blocks: [DONE_A], days: [COMPLETED_DAY] }, checkIn({}))
    expect(write.expected).toEqual({
      [`plan_block_state:${PLAN_B}/${BLOCK_B}`]: 0,
      [`daily_activity:${DAY}`]: 1,
    })
    expect(write.changes).toContainEqual({
      table: 'daily_activity',
      row: {
        local_day: DAY,
        minutes_by_track: { dsa: 30, english: 0 },
        items_done: 0,
        completed: true,
      },
    })
  })

  it("(the wrong path) loading only the block being checked in writes completed: false at the day row's right version", () => {
    // Plan A's done block is not loaded: the day is recomputed from plan B's skipped block alone,
    // and expected 1 matches the stored row, so apply_derived_changes would store it — the
    // streak breaks silently. This is why the contract requires every block of the day.
    const write = writeFor({ items: [], blocks: [], days: [COMPLETED_DAY] }, checkIn({}))
    expect(write.expected[`daily_activity:${DAY}`]).toBe(1)
    expect(write.changes).toContainEqual({
      table: 'daily_activity',
      row: { local_day: DAY, minutes_by_track: { english: 0 }, items_done: 0, completed: false },
    })
  })

  it("updates the older day of an edited check-in: its checked_in_on day's row is loaded", () => {
    // Plan A's block was done on DAY and is edited to skipped on NEXT_DAY: it still counts for
    // DAY (decision 6), so the caller loads DAY's blocks and DAY's row — not NEXT_DAY's.
    const write = writeFor(
      { items: [], blocks: [DONE_A], days: [COMPLETED_DAY] },
      checkIn({
        localDay: NEXT_DAY,
        occurredAt: '2026-09-29T10:00:00.000Z',
        trackId: 'dsa',
        planId: PLAN_A,
        blockId: DONE_A.block_id,
        payload: { status: 'skipped', minutes: 0 },
      }),
    )
    expect(write.expected).toEqual({
      [`plan_block_state:${PLAN_A}/${DONE_A.block_id}`]: 1,
      [`daily_activity:${DAY}`]: 1,
    })
    expect(write.changes).toContainEqual({
      table: 'daily_activity',
      row: { local_day: DAY, minutes_by_track: { dsa: 0 }, items_done: 0, completed: false },
    })
  })

  it('M-6 (a): a skipped check-in resumed on a later day moves there, so both days are written', () => {
    // Plan A's block was skipped on DAY and is edited to done on NEXT_DAY: it now counts for
    // NEXT_DAY, so the caller loads DAY's blocks and row (DAY loses the block) and NEXT_DAY's
    // blocks and row (none yet: NEXT_DAY's row is new).
    const skippedA: BlockStateRow = { ...DONE_A, status: 'skipped', minutes: 0, version: 2 }
    const openDay: DailyActivityRow = {
      ...COMPLETED_DAY,
      minutes_by_track: { dsa: 0 },
      completed: false,
      version: 3,
    }
    const write = writeFor(
      { items: [], blocks: [skippedA], days: [openDay] },
      checkIn({
        localDay: NEXT_DAY,
        occurredAt: '2026-09-29T10:00:00.000Z',
        trackId: 'dsa',
        planId: PLAN_A,
        blockId: DONE_A.block_id,
        payload: { status: 'done', minutes: 20 },
      }),
    )
    expect(write.expected).toEqual({
      [`plan_block_state:${PLAN_A}/${DONE_A.block_id}`]: 2,
      [`daily_activity:${DAY}`]: 3,
      [`daily_activity:${NEXT_DAY}`]: 0,
    })
    expect(write.changes).toContainEqual({
      table: 'plan_block_state',
      row: expect.objectContaining({ status: 'done', minutes: 20, checked_in_on: NEXT_DAY }),
    })
    expect(write.changes).toContainEqual({
      table: 'daily_activity',
      row: { local_day: DAY, minutes_by_track: {}, items_done: 0, completed: false },
    })
    expect(write.changes).toContainEqual({
      table: 'daily_activity',
      row: { local_day: NEXT_DAY, minutes_by_track: { dsa: 20 }, items_done: 0, completed: true },
    })
  })
})
