import { describe, expect, it } from 'vitest'
import type { CheckInStatus } from '../state'
import { blockKey, type BlockState } from '../state'
import type { LocalDay } from '../time/localDay'
import { gateStatus, lastSeenPlan, RESUME_AFTER_DAYS, unfinishedBlocks } from './gate'
import type { PlanBlock, StoredPlan } from './types'

const TODAY: LocalDay = '2026-09-25'
const YESTERDAY: LocalDay = '2026-09-24'

function block(id: string, trackId = 'dsa'): PlanBlock {
  return { id, trackId, kind: 'review', estMinutes: 10, items: [] }
}

/** A stored plan with the given block IDs. `seenAt: null` makes it an unseen plan. */
function plan(
  planDate: LocalDay,
  blockIds: readonly string[],
  seenAt: string | null = `${planDate}T04:00:00.000Z`,
): StoredPlan {
  return {
    id: `plan-${planDate}`,
    planDate,
    version: 1,
    source: 'baseline',
    seenAt,
    blocks: blockIds.map((id) => block(id)),
    tracks: {},
  }
}

function checkIn(
  planId: string,
  blockId: string,
  status: CheckInStatus,
  checkedInOn: LocalDay,
  trackId = 'dsa',
): BlockState {
  return {
    planId,
    blockId,
    trackId,
    status,
    minutes: 10,
    note: null,
    auto: false,
    checkedInOn,
  }
}

function blockStates(...states: readonly BlockState[]): Record<string, BlockState> {
  return Object.fromEntries(states.map((state) => [blockKey(state.planId, state.blockId), state]))
}

describe('lastSeenPlan (§5.2)', () => {
  it('picks the latest planDate among seen plans before today, whatever the input order', () => {
    const early = plan('2026-09-10', ['b1'])
    const mid = plan('2026-09-20', ['b1'])
    const late = plan('2026-09-24', ['b1'])
    expect(lastSeenPlan([mid, late, early], TODAY)).toBe(late)
    expect(lastSeenPlan([late, early, mid], TODAY)).toBe(late)
  })

  it('ignores unseen plans, even a later one', () => {
    const seen = plan('2026-09-20', ['b1'])
    const unseenLater = plan('2026-09-24', ['b1'], null)
    expect(lastSeenPlan([seen, unseenLater], TODAY)).toBe(seen)
  })

  it('ignores today\'s plan (not "last")', () => {
    const today = plan(TODAY, ['b1'])
    expect(lastSeenPlan([today], TODAY)).toBeNull()
  })

  it('no plans → null', () => {
    expect(lastSeenPlan([], TODAY)).toBeNull()
  })
})

describe('gateStatus (§5.2, §5.9, decision 32)', () => {
  it('no plans → open, lastSeen null', () => {
    expect(gateStatus([], {}, TODAY)).toEqual({ open: true, lastSeen: null, resumedToday: false })
  })

  it('only a plan for today → open (today\'s plan is not "last")', () => {
    const today = plan(TODAY, ['b1'])
    const status = gateStatus([today], {}, TODAY)
    expect(status).toEqual({ open: true, lastSeen: null, resumedToday: false })
  })

  it('last seen plan with a done block → open', () => {
    const last = plan(YESTERDAY, ['b1'])
    const blocks = blockStates(checkIn(last.id, 'b1', 'done', YESTERDAY))
    const status = gateStatus([last], blocks, TODAY)
    expect(status.open).toBe(true)
  })

  it('last seen plan with a partial block → open', () => {
    const last = plan(YESTERDAY, ['b1'])
    const blocks = blockStates(checkIn(last.id, 'b1', 'partial', YESTERDAY))
    expect(gateStatus([last], blocks, TODAY).open).toBe(true)
  })

  it('last seen plan with everything skipped → closed', () => {
    const last = plan(YESTERDAY, ['b1', 'b2'])
    const blocks = blockStates(
      checkIn(last.id, 'b1', 'skipped', YESTERDAY),
      checkIn(last.id, 'b2', 'skipped', YESTERDAY),
    )
    expect(gateStatus([last], blocks, TODAY).open).toBe(false)
  })

  it('last seen plan with no check-in at all → closed', () => {
    const last = plan(YESTERDAY, ['b1'])
    expect(gateStatus([last], {}, TODAY).open).toBe(false)
  })

  it('a check-in made two days after the plan date still opens the gate', () => {
    const planDate = '2026-09-20'
    const last = plan(planDate, ['b1'])
    const blocks = blockStates(checkIn(last.id, 'b1', 'done', '2026-09-22'))
    expect(gateStatus([last], blocks, TODAY).open).toBe(true)
  })

  it('a seen plan with zero blocks → open', () => {
    const last = plan(YESTERDAY, [])
    const status = gateStatus([last], {}, TODAY)
    expect(status).toEqual({ open: true, lastSeen: last, resumedToday: false })
  })

  describe('resumedToday (decision 32)', () => {
    it("yesterday's seen plan whose first done check-in is today → open, resumedToday true", () => {
      const last = plan(YESTERDAY, ['b1'])
      const blocks = blockStates(checkIn(last.id, 'b1', 'done', TODAY))
      expect(gateStatus([last], blocks, TODAY)).toEqual({
        open: true,
        lastSeen: last,
        resumedToday: true,
      })
    })

    it('checked in yesterday → resumedToday false', () => {
      const last = plan(YESTERDAY, ['b1'])
      const blocks = blockStates(checkIn(last.id, 'b1', 'done', YESTERDAY))
      expect(gateStatus([last], blocks, TODAY)).toEqual({
        open: true,
        lastSeen: last,
        resumedToday: false,
      })
    })

    it('a skipped check-in yesterday and a done one today → resumedToday true', () => {
      const last = plan(YESTERDAY, ['b1', 'b2'])
      const blocks = blockStates(
        checkIn(last.id, 'b1', 'skipped', YESTERDAY),
        checkIn(last.id, 'b2', 'done', TODAY),
      )
      expect(gateStatus([last], blocks, TODAY)).toEqual({
        open: true,
        lastSeen: last,
        resumedToday: true,
      })
    })

    it('no last seen plan → resumedToday false', () => {
      expect(gateStatus([], {}, TODAY)).toEqual({ open: true, lastSeen: null, resumedToday: false })
    })
  })

  describe('[RF-5] offerResume', () => {
    it('closed with the last seen plan 3 days old → offerResume true, daysSince 3', () => {
      const staleDate = '2026-09-22'
      const last = plan(staleDate, ['b1'])
      const blocks = blockStates(checkIn(last.id, 'b1', 'skipped', staleDate))
      expect(gateStatus([last], blocks, TODAY)).toEqual({
        open: false,
        lastSeen: last,
        daysSince: 3,
        offerResume: true,
      })
      expect(RESUME_AFTER_DAYS).toBe(2)
    })

    it('closed with the last seen plan 2 days old → offerResume false', () => {
      const staleDate = '2026-09-23'
      const last = plan(staleDate, ['b1'])
      const blocks = blockStates(checkIn(last.id, 'b1', 'skipped', staleDate))
      expect(gateStatus([last], blocks, TODAY)).toEqual({
        open: false,
        lastSeen: last,
        daysSince: 2,
        offerResume: false,
      })
    })
  })

  describe('an unseen later plan is ignored', () => {
    it('the gate follows the earlier seen (open) plan', () => {
      const earlierSeen = plan('2026-09-10', ['b1'])
      const blocks = blockStates(checkIn(earlierSeen.id, 'b1', 'done', '2026-09-10'))
      const unseenLater = plan(YESTERDAY, ['b1'], null)
      expect(gateStatus([earlierSeen, unseenLater], blocks, TODAY)).toEqual({
        open: true,
        lastSeen: earlierSeen,
        resumedToday: false,
      })
    })

    it('the gate follows the earlier seen (closed) plan', () => {
      const earlierSeen = plan('2026-09-10', ['b1'])
      const unseenLater = plan(YESTERDAY, ['b1'], null)
      const status = gateStatus([earlierSeen, unseenLater], {}, TODAY)
      expect(status.open).toBe(false)
      if (!status.open) expect(status.lastSeen).toBe(earlierSeen)
    })
  })
})

describe('unfinishedBlocks (M5 paused view)', () => {
  it('keeps plan order and drops done/partial blocks, keeps skipped', () => {
    const last = plan(YESTERDAY, ['b1', 'b2', 'b3'])
    const blocks = blockStates(
      checkIn(last.id, 'b1', 'done', YESTERDAY),
      checkIn(last.id, 'b2', 'skipped', YESTERDAY),
      // b3 has no check-in at all.
    )
    const remaining = unfinishedBlocks(last, blocks)
    expect(remaining.map((b) => b.id)).toEqual(['b2', 'b3'])
  })
})

describe('M-5 (A): blocks of tracks no longer active never hold the gate closed', () => {
  /** DSA was paused or removed since yesterday; only English is active. */
  const ACTIVE = new Set(['english'])

  /** A seen plan of `planDate` with the given `[blockId, trackId]` blocks. */
  function mixedPlan(planDate: LocalDay, blocks: readonly [string, string][]): StoredPlan {
    return { ...plan(planDate, []), blocks: blocks.map(([id, trackId]) => block(id, trackId)) }
  }

  it('only blocks of an inactive track, none checked in → open, resumedToday false', () => {
    const last = mixedPlan(YESTERDAY, [
      ['dsa:review:1', 'dsa'],
      ['dsa:new:1', 'dsa'],
    ])
    expect(gateStatus([last], {}, TODAY, ACTIVE)).toEqual({
      open: true,
      lastSeen: last,
      resumedToday: false,
    })
  })

  it('blocks of an inactive and an active track, none done → closed', () => {
    const last = mixedPlan(YESTERDAY, [
      ['dsa:new:1', 'dsa'],
      ['english:new:1', 'english'],
    ])
    const blocks = blockStates(checkIn(last.id, 'english:new:1', 'skipped', YESTERDAY, 'english'))
    expect(gateStatus([last], blocks, TODAY, ACTIVE)).toEqual({
      open: false,
      lastSeen: last,
      daysSince: 1,
      offerResume: false,
    })
  })

  it('a done block of the inactive track still opens it', () => {
    const last = mixedPlan(YESTERDAY, [
      ['dsa:new:1', 'dsa'],
      ['english:new:1', 'english'],
    ])
    const blocks = blockStates(checkIn(last.id, 'dsa:new:1', 'done', YESTERDAY))
    expect(gateStatus([last], blocks, TODAY, ACTIVE)).toEqual({
      open: true,
      lastSeen: last,
      resumedToday: false,
    })
  })

  it('unfinishedBlocks with the set lists only the unfinished blocks of active tracks', () => {
    const last = mixedPlan(YESTERDAY, [
      ['dsa:review:1', 'dsa'],
      ['english:review:1', 'english'],
      ['dsa:new:1', 'dsa'],
      ['english:new:1', 'english'],
    ])
    const blocks = blockStates(
      checkIn(last.id, 'english:review:1', 'done', YESTERDAY, 'english'),
      checkIn(last.id, 'dsa:new:1', 'skipped', YESTERDAY),
    )
    expect(unfinishedBlocks(last, blocks, ACTIVE).map((b) => b.id)).toEqual(['english:new:1'])
    // Without the set every track counts (M4).
    expect(unfinishedBlocks(last, blocks).map((b) => b.id)).toEqual([
      'dsa:review:1',
      'dsa:new:1',
      'english:new:1',
    ])
  })

  it('without the set, a plan of only DSA blocks stays closed (M4 behaviour)', () => {
    const last = mixedPlan(YESTERDAY, [['dsa:new:1', 'dsa']])
    expect(gateStatus([last], {}, TODAY).open).toBe(false)
    expect(gateStatus([last], {}, TODAY, new Set(['dsa'])).open).toBe(false)
  })
})
