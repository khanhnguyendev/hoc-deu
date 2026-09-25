import { describe, expect, it } from 'vitest'
import { blockKey, type BlockState, type CheckInStatus } from '../state'
import type { LocalDay } from '../time/localDay'
import { enrollment } from './__tests__/fixtures'
import { recapWeeksDone } from './history'
import type { PlanBlock, StoredPlan, TrackSnapshot } from './types'

function recapBlock(id: string, trackId: string, recapWeek: number | null): PlanBlock {
  return { id, trackId, kind: 'recap', estMinutes: 10, items: [], recapWeek }
}

function snapshot(variant: string): TrackSnapshot {
  return { variant, week: 1, dueCount: 0, newPerDay: null, throttled: false, reviewDebt: false }
}

function plan(
  planDate: LocalDay,
  blocks: readonly PlanBlock[],
  tracks: Readonly<Record<string, TrackSnapshot>>,
): StoredPlan {
  return {
    id: `plan-${planDate}`,
    planDate,
    version: 1,
    source: 'baseline',
    seenAt: `${planDate}T04:00:00.000Z`,
    blocks,
    tracks,
  }
}

function checkIn(
  planId: string,
  blockId: string,
  trackId: string,
  status: CheckInStatus,
): BlockState {
  return {
    planId,
    blockId,
    trackId,
    status,
    minutes: 10,
    note: null,
    auto: false,
    checkedInOn: '2026-10-04',
  }
}

function blockStates(...states: readonly BlockState[]): Record<string, BlockState> {
  return Object.fromEntries(states.map((state) => [blockKey(state.planId, state.blockId), state]))
}

describe('recapWeeksDone (§5.6)', () => {
  it('a done recap block with recapWeek: 1 → { dsa: {1} }', () => {
    const dsa = enrollment('dsa')
    const p = plan('2026-10-04', [recapBlock('r1', 'dsa', 1)], { dsa: snapshot(dsa.variant) })
    const blocks = blockStates(checkIn(p.id, 'r1', 'dsa', 'done'))
    expect(recapWeeksDone([p], blocks, [dsa])).toEqual({ dsa: new Set([1]) })
  })

  it('a partial recap block also counts', () => {
    const dsa = enrollment('dsa')
    const p = plan('2026-10-04', [recapBlock('r1', 'dsa', 1)], { dsa: snapshot(dsa.variant) })
    const blocks = blockStates(checkIn(p.id, 'r1', 'dsa', 'partial'))
    expect(recapWeeksDone([p], blocks, [dsa])).toEqual({ dsa: new Set([1]) })
  })

  it('a skipped recap block → empty', () => {
    const dsa = enrollment('dsa')
    const p = plan('2026-10-04', [recapBlock('r1', 'dsa', 1)], { dsa: snapshot(dsa.variant) })
    const blocks = blockStates(checkIn(p.id, 'r1', 'dsa', 'skipped'))
    expect(recapWeeksDone([p], blocks, [dsa])).toEqual({ dsa: new Set() })
  })

  it('a recap block with no check-in at all → empty', () => {
    const dsa = enrollment('dsa')
    const p = plan('2026-10-04', [recapBlock('r1', 'dsa', 1)], { dsa: snapshot(dsa.variant) })
    expect(recapWeeksDone([p], {}, [dsa])).toEqual({ dsa: new Set() })
  })

  it("a recap block whose plan snapshot variant differs from the enrollment's is ignored", () => {
    const dsa = enrollment('dsa') // variant '8w'
    const p = plan('2026-10-04', [recapBlock('r1', 'dsa', 1)], { dsa: snapshot('10w') })
    const blocks = blockStates(checkIn(p.id, 'r1', 'dsa', 'done'))
    expect(recapWeeksDone([p], blocks, [dsa])).toEqual({ dsa: new Set() })
  })

  it('a plan dated before resetOn is ignored; on resetOn it counts', () => {
    const dsa = enrollment('dsa', { resetOn: '2026-10-01' })
    const before = plan('2026-09-30', [recapBlock('r1', 'dsa', 1)], { dsa: snapshot(dsa.variant) })
    const onReset = plan('2026-10-01', [recapBlock('r2', 'dsa', 2)], { dsa: snapshot(dsa.variant) })
    const blocks = blockStates(
      checkIn(before.id, 'r1', 'dsa', 'done'),
      checkIn(onReset.id, 'r2', 'dsa', 'done'),
    )
    expect(recapWeeksDone([before, onReset], blocks, [dsa])).toEqual({ dsa: new Set([2]) })
  })

  it('recapWeek: null is ignored', () => {
    const dsa = enrollment('dsa')
    const p = plan('2026-10-04', [recapBlock('r1', 'dsa', null)], { dsa: snapshot(dsa.variant) })
    const blocks = blockStates(checkIn(p.id, 'r1', 'dsa', 'done'))
    expect(recapWeeksDone([p], blocks, [dsa])).toEqual({ dsa: new Set() })
  })

  it('an English enrollment (no recap blocks in its template) → an empty set', () => {
    const english = enrollment('english')
    expect(recapWeeksDone([], {}, [english])).toEqual({ english: new Set() })
  })

  it('every enrollment gets an entry, possibly empty, even a track no plan mentions', () => {
    const dsa = enrollment('dsa')
    const english = enrollment('english')
    const p = plan('2026-10-04', [recapBlock('r1', 'dsa', 1)], { dsa: snapshot(dsa.variant) })
    const blocks = blockStates(checkIn(p.id, 'r1', 'dsa', 'done'))
    expect(recapWeeksDone([p], blocks, [dsa, english])).toEqual({
      dsa: new Set([1]),
      english: new Set(),
    })
  })

  it('accumulates several done recap weeks for the same track', () => {
    const dsa = enrollment('dsa')
    const p1 = plan('2026-10-04', [recapBlock('r1', 'dsa', 1)], { dsa: snapshot(dsa.variant) })
    const p2 = plan('2026-10-11', [recapBlock('r2', 'dsa', 2)], { dsa: snapshot(dsa.variant) })
    const blocks = blockStates(
      checkIn(p1.id, 'r1', 'dsa', 'done'),
      checkIn(p2.id, 'r2', 'dsa', 'partial'),
    )
    expect(recapWeeksDone([p1, p2], blocks, [dsa])).toEqual({ dsa: new Set([1, 2]) })
  })
})
