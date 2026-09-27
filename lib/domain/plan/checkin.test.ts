import { describe, expect, it } from 'vitest'
import { blockKey, type BlockState, type ItemState } from '../state'
import type { LocalDay } from '../time/localDay'
import { itemState, statesOf } from './__tests__/fixtures'
import {
  autoCheckInMinutes,
  blocksToAutoCheckIn,
  blocksWithItem,
  itemHandled,
  itemStudied,
  oneTapMinutes,
} from './checkin'
import type { PlanBlock, StoredPlan } from './types'

const PLAN_DATE: LocalDay = '2026-09-28'
const DAY_BEFORE: LocalDay = '2026-09-27'
const DAY_AFTER: LocalDay = '2026-09-29'

/** Deep-freezes a fixture, so a function that mutates its input fails the test. */
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const entry of Object.values(value)) deepFreeze(entry)
    Object.freeze(value)
  }
  return value
}

function block(id: string, itemIds: readonly string[], change: Partial<PlanBlock> = {}): PlanBlock {
  return {
    id: `${PLAN_DATE}:dsa:${id}`,
    trackId: 'dsa',
    kind: 'new',
    estMinutes: itemIds.length * 10,
    items: itemIds.map((itemId) => ({ itemId, mode: 'new', minutes: 10 })),
    ...change,
  }
}

function plan(blocks: readonly PlanBlock[]): StoredPlan {
  return deepFreeze({
    id: 'plan-1',
    planDate: PLAN_DATE,
    version: 1,
    source: 'baseline',
    seenAt: `${PLAN_DATE}T03:00:00.000Z`,
    blocks,
    tracks: {},
  })
}

function checkIn(target: PlanBlock, change: Partial<BlockState> = {}): Record<string, BlockState> {
  return deepFreeze({
    [blockKey('plan-1', target.id)]: {
      planId: 'plan-1',
      blockId: target.id,
      trackId: target.trackId,
      status: 'done',
      minutes: Math.ceil(target.estMinutes),
      note: null,
      auto: false,
      checkedInOn: PLAN_DATE,
      ...change,
    },
  })
}

const done = (itemId: string, day: LocalDay = PLAN_DATE): ItemState => itemState(itemId, day)
const items = (...states: readonly ItemState[]) => deepFreeze(statesOf(...states))
/** Skipped without a result (a new item the learner skipped: "Bỏ qua mục này"). */
const skipped = (itemId: string): ItemState =>
  itemState(itemId, PLAN_DATE, {
    status: 'skipped',
    level: 0,
    lastResult: null,
    lastResultOn: null,
  })

describe('itemHandled (§5.5, decision 15)', () => {
  it('is true for a result on the plan date', () => {
    expect(itemHandled('dsa:p1', PLAN_DATE, items(done('dsa:p1')))).toBe(true)
  })

  it('is true for a result after the plan date (a paused plan finished later)', () => {
    expect(itemHandled('dsa:p1', PLAN_DATE, items(done('dsa:p1', DAY_AFTER)))).toBe(true)
  })

  it('is false for a result before the plan date (an older review)', () => {
    expect(itemHandled('dsa:p1', PLAN_DATE, items(done('dsa:p1', DAY_BEFORE)))).toBe(false)
  })

  it('is true for a skipped item, whatever its last result', () => {
    const skipped = itemState('dsa:p1', DAY_BEFORE, {
      status: 'skipped',
      level: 0,
      lastResult: null,
      lastResultOn: null,
    })
    expect(itemHandled('dsa:p1', PLAN_DATE, items(skipped))).toBe(true)
  })

  it('is false without a row, and reads own keys only', () => {
    expect(itemHandled('dsa:p1', PLAN_DATE, items())).toBe(false)
    expect(itemHandled('constructor', PLAN_DATE, items())).toBe(false)
  })
})

describe('itemStudied (decision 15, ruling M5-R36: a skip is not a result)', () => {
  it('is true for a result on or after the plan date', () => {
    expect(itemStudied('dsa:p1', PLAN_DATE, items(done('dsa:p1')))).toBe(true)
    expect(itemStudied('dsa:p1', PLAN_DATE, items(done('dsa:p1', DAY_AFTER)))).toBe(true)
  })

  it('is false for a result before the plan date, and without a row (own keys only)', () => {
    expect(itemStudied('dsa:p1', PLAN_DATE, items(done('dsa:p1', DAY_BEFORE)))).toBe(false)
    expect(itemStudied('dsa:p1', PLAN_DATE, items())).toBe(false)
    expect(itemStudied('constructor', PLAN_DATE, items())).toBe(false)
  })

  it('is false for an item skipped without a result: handled, never studied', () => {
    const state = items(skipped('dsa:p1'))
    expect(itemHandled('dsa:p1', PLAN_DATE, state)).toBe(true)
    expect(itemStudied('dsa:p1', PLAN_DATE, state)).toBe(false)
  })

  it('is true for an item skipped after a result on the plan date: the result was study', () => {
    const later = itemState('dsa:p1', PLAN_DATE, { status: 'skipped', dueOn: null })
    expect(itemStudied('dsa:p1', PLAN_DATE, items(later))).toBe(true)
  })
})

describe('autoCheckInMinutes (decision 15, ruling M5-R36)', () => {
  const pair = block('new:1', ['dsa:p1', 'dsa:p2'])

  it('every item studied: the block estimate, checkInMinutes(block)', () => {
    expect(autoCheckInMinutes(pair, PLAN_DATE, items(done('dsa:p1'), done('dsa:p2')))).toBe(20)
  })

  it('a mixed block credits only the studied items: a skipped item credits nothing', () => {
    expect(autoCheckInMinutes(pair, PLAN_DATE, items(skipped('dsa:p1'), done('dsa:p2')))).toBe(10)
  })

  it('an older result credits nothing, and neither does a block with nothing studied', () => {
    expect(autoCheckInMinutes(pair, PLAN_DATE, items(done('dsa:p1', DAY_BEFORE)))).toBe(0)
    expect(autoCheckInMinutes(pair, PLAN_DATE, items(skipped('dsa:p1'), skipped('dsa:p2')))).toBe(0)
  })

  it('is the ceiling of the studied minutes: 7.5 + a skipped 7.5 gives 8', () => {
    const halves = block('review:1', ['dsa:p1', 'dsa:p2'], {
      kind: 'review',
      estMinutes: 15,
      items: [
        { itemId: 'dsa:p1', mode: 'review', minutes: 7.5 },
        { itemId: 'dsa:p2', mode: 'review', minutes: 7.5 },
      ],
    })
    expect(autoCheckInMinutes(halves, PLAN_DATE, items(done('dsa:p1'), skipped('dsa:p2')))).toBe(8)
  })
})

describe('oneTapMinutes (ruling M5-R39 #3)', () => {
  const pair = block('new:1', ['dsa:p1', 'dsa:p2'])
  const halves = block('review:1', ['dsa:p1', 'dsa:p2', 'dsa:p3'], {
    kind: 'review',
    estMinutes: 4.5,
    items: [
      { itemId: 'dsa:p1', mode: 'review', minutes: 1.5 },
      { itemId: 'dsa:p2', mode: 'review', minutes: 1.5 },
      { itemId: 'dsa:p3', mode: 'review', minutes: 1.5 },
    ],
  })

  it('nothing skipped: the block estimate, rounded up (checkInMinutes)', () => {
    expect(oneTapMinutes(pair, PLAN_DATE, items())).toBe(20)
    expect(oneTapMinutes(pair, PLAN_DATE, items(done('dsa:p1')))).toBe(20)
    expect(oneTapMinutes(halves, PLAN_DATE, items())).toBe(5)
  })

  it('leaves out the skipped items, then rounds up: 4.5 − 1.5 gives 3, 4.5 − 3 gives 2', () => {
    expect(oneTapMinutes(pair, PLAN_DATE, items(skipped('dsa:p1')))).toBe(10)
    expect(oneTapMinutes(halves, PLAN_DATE, items(skipped('dsa:p2')))).toBe(3)
    expect(oneTapMinutes(halves, PLAN_DATE, items(skipped('dsa:p1'), skipped('dsa:p3')))).toBe(2)
  })

  it('every item skipped: 0 (a valid `done` payload, as the sheet allows)', () => {
    expect(oneTapMinutes(pair, PLAN_DATE, items(skipped('dsa:p1'), skipped('dsa:p2')))).toBe(0)
  })

  it('an item skipped after a result on the plan date was studied: its minutes count', () => {
    const later = itemState('dsa:p1', PLAN_DATE, { status: 'skipped', dueOn: null })
    expect(oneTapMinutes(pair, PLAN_DATE, items(later))).toBe(20)
    // A result before the plan date is not study for this plan: the skip leaves the item out.
    const older = itemState('dsa:p1', DAY_BEFORE, { status: 'skipped', dueOn: null })
    expect(oneTapMinutes(pair, PLAN_DATE, items(older))).toBe(10)
  })

  it('reads own keys only, and never goes below 0', () => {
    const proto = block('new:2', ['constructor'])
    expect(oneTapMinutes(proto, PLAN_DATE, items())).toBe(10)
    const short = block('new:3', ['dsa:p1'], { estMinutes: 5 })
    expect(oneTapMinutes(short, PLAN_DATE, items(skipped('dsa:p1')))).toBe(0)
  })
})

describe('blocksWithItem (decision 14)', () => {
  it("lists the plan's blocks that list the item, in plan order", () => {
    const first = block('new:1', ['dsa:p1', 'dsa:p2'])
    const other = block('review:1', ['dsa:p3'], { kind: 'review' })
    const second = block('recap:1', ['dsa:p4', 'dsa:p1'], { kind: 'recap' })
    expect(blocksWithItem(plan([first, other, second]), 'dsa:p1')).toEqual([first, second])
    expect(blocksWithItem(plan([first, other, second]), 'dsa:p9')).toEqual([])
  })
})

describe('blocksToAutoCheckIn (§5.5, decision 15)', () => {
  const pair = block('new:1', ['dsa:p1', 'dsa:p2'])

  it('checks in a two-item block when its last item gets a result', () => {
    const target = plan([pair])
    expect(
      blocksToAutoCheckIn(target, {}, items(done('dsa:p1'), done('dsa:p2')), 'dsa:p2'),
    ).toEqual([pair])
  })

  it('checks in nothing after the first item of the block', () => {
    expect(blocksToAutoCheckIn(plan([pair]), {}, items(done('dsa:p1')), 'dsa:p1')).toEqual([])
  })

  it('counts a skipped item as handled', () => {
    const skipped = itemState('dsa:p1', PLAN_DATE, { status: 'skipped', lastResultOn: null })
    expect(blocksToAutoCheckIn(plan([pair]), {}, items(skipped, done('dsa:p2')), 'dsa:p2')).toEqual(
      [pair],
    )
  })

  it('checks in nothing when every item of the block is skipped: a skip is not a result (M5-R36)', () => {
    const all = items(skipped('dsa:p1'), skipped('dsa:p2'))
    expect(blocksToAutoCheckIn(plan([pair]), {}, all, 'dsa:p2')).toEqual([])
    const one = block('new:1', ['dsa:p1'])
    expect(blocksToAutoCheckIn(plan([one]), {}, items(skipped('dsa:p1')), 'dsa:p1')).toEqual([])
  })

  it('does not count a result from before the plan date', () => {
    const old = done('dsa:p1', DAY_BEFORE)
    expect(blocksToAutoCheckIn(plan([pair]), {}, items(old, done('dsa:p2')), 'dsa:p2')).toEqual([])
  })

  it('leaves a block that already has a check-in alone — a skip included (M-6)', () => {
    const all = items(done('dsa:p1'), done('dsa:p2'))
    for (const status of ['done', 'partial', 'skipped'] as const) {
      expect(blocksToAutoCheckIn(plan([pair]), checkIn(pair, { status }), all, 'dsa:p2')).toEqual(
        [],
      )
    }
    // Even an auto check-in: only the extra block is checked in again.
    expect(
      blocksToAutoCheckIn(plan([pair]), checkIn(pair, { auto: true, minutes: 5 }), all, 'dsa:p2'),
    ).toEqual([])
  })

  it('checks in every block listing the item that is now complete, in plan order', () => {
    const review = block('review:1', ['dsa:p2'], { kind: 'review' })
    const other = block('new:2', ['dsa:p3', 'dsa:p2'])
    const target = plan([pair, review, other])
    expect(
      blocksToAutoCheckIn(target, {}, items(done('dsa:p1'), done('dsa:p2')), 'dsa:p2'),
    ).toEqual([pair, review])
  })

  describe('the extra block (decision 15)', () => {
    const extra = block('extra:1', ['dsa:p1', 'dsa:p2'], { kind: 'extra' })
    const all = items(done('dsa:p1'), done('dsa:p2'))

    it('is checked in again while its check-in is auto and its minutes differ', () => {
      const grew = checkIn(extra, { auto: true, minutes: 10 })
      expect(blocksToAutoCheckIn(plan([extra]), grew, all, 'dsa:p2')).toEqual([extra])
    })

    it('is left alone when the auto check-in already has its minutes', () => {
      const same = checkIn(extra, { auto: true, minutes: 20 })
      expect(blocksToAutoCheckIn(plan([extra]), same, all, 'dsa:p2')).toEqual([])
    })

    it("is left alone once the learner's own check-in replaced the auto one", () => {
      const edited = checkIn(extra, { auto: false, minutes: 10 })
      expect(blocksToAutoCheckIn(plan([extra]), edited, all, 'dsa:p2')).toEqual([])
    })

    it('rounds up like checkInMinutes: a 7.5-minute extra block expects 8', () => {
      const short = block('extra:1', ['dsa:p1'], {
        kind: 'extra',
        estMinutes: 7.5,
        items: [{ itemId: 'dsa:p1', mode: 'new', minutes: 7.5 }],
      })
      const one = items(done('dsa:p1'))
      expect(
        blocksToAutoCheckIn(
          plan([short]),
          checkIn(short, { auto: true, minutes: 8 }),
          one,
          'dsa:p1',
        ),
      ).toEqual([])
      expect(
        blocksToAutoCheckIn(
          plan([short]),
          checkIn(short, { auto: true, minutes: 7 }),
          one,
          'dsa:p1',
        ),
      ).toEqual([short])
    })

    it('follows the studied minutes (M5-R36): an added item skipped changes nothing', () => {
      const mixed = items(done('dsa:p1'), skipped('dsa:p2'))
      const studiedOnly = checkIn(extra, { auto: true, minutes: 10 })
      expect(blocksToAutoCheckIn(plan([extra]), studiedOnly, mixed, 'dsa:p2')).toEqual([])
      // Checked in with the full estimate before the rule: re-sent with the studied minutes.
      const full = checkIn(extra, { auto: true, minutes: 20 })
      expect(blocksToAutoCheckIn(plan([extra]), full, mixed, 'dsa:p2')).toEqual([extra])
    })
  })
})
