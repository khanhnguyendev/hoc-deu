import { describe, expect, it } from 'vitest'
import { CATALOG, MONDAY } from '../plan/__tests__/fixtures'
import { mulberry32 } from '../random'
import { RULES_VERSION } from '../rules'
import { EMPTY_DERIVED_STATE, type DerivedState } from '../state'
import type { LocalDay } from '../time/localDay'
import { deepFreeze, eventBuilder, type EventBuilder } from './__tests__/events'
import { project, type DomainEvent } from './project'
import { replay } from './replay'

/** The track of a namespaced item ID (`dsa:p1` → `dsa`). */
const trackOf = (itemId: string): string => itemId.slice(0, itemId.indexOf(':'))

/** Study helpers over one builder, so ids and `occurredAt` follow the call order. */
function studyDay(event: EventBuilder) {
  return {
    result: (localDay: LocalDay, itemId: string, result: string): DomainEvent =>
      event('item.result', { localDay, trackId: trackOf(itemId), itemId, payload: { result } }),
    plan: (localDay: LocalDay): DomainEvent =>
      event('plan.generated', {
        localDay,
        planId: `plan-${localDay}`,
        payload: { mode: 'baseline', planVersion: 1 },
      }),
    checkIn: (localDay: LocalDay, trackId: string, status: string, minutes: number): DomainEvent =>
      event('block.checked_in', {
        localDay,
        trackId,
        planId: `plan-${localDay}`,
        blockId: `${localDay}:${trackId}:new:1`,
        payload: { status, minutes },
      }),
  }
}

/**
 * Three weeks from Monday 2026-09-28 for a learner in both tracks, in time order: enrolment,
 * results over several days, check-ins, a skip, an English pause and resume, a DSA reset, and three
 * events that change nothing (an invalid payload, an unknown item, a completion of the wrong type).
 */
function threeWeeks() {
  const event = eventBuilder()
  const { result, plan, checkIn } = studyDay(event)
  const ignoredIds: string[] = []
  const toBeIgnored = (ignored: DomainEvent): DomainEvent => {
    ignoredIds.push(ignored.id)
    return ignored
  }

  const events = [
    // Week 1
    event('track.enrolled', {
      trackId: 'dsa',
      payload: { roadmapVariant: '8w', budgetMinutes: 60, startDate: MONDAY },
    }),
    event('track.enrolled', {
      trackId: 'english',
      payload: { roadmapVariant: '10w', budgetMinutes: 25, startDate: MONDAY },
    }),
    plan(MONDAY),
    event('lesson.completed', { trackId: 'dsa', itemId: 'dsa:lesson-arrays' }),
    result(MONDAY, 'dsa:p1', 'solved'),
    result(MONDAY, 'english:e1', 'know'),
    result(MONDAY, 'english:e2', 'dont_know'),
    checkIn(MONDAY, 'dsa', 'done', 45),
    checkIn(MONDAY, 'english', 'done', 15),

    plan('2026-09-29'),
    result('2026-09-29', 'english:e1', 'unsure'),
    result('2026-09-29', 'english:e2', 'know'),
    result('2026-09-29', 'dsa:p2', 'hint'),
    event('item.skipped', { localDay: '2026-09-29', trackId: 'dsa', itemId: 'dsa:p3' }),
    checkIn('2026-09-29', 'dsa', 'partial', 20),
    checkIn('2026-09-29', 'english', 'done', 10),

    plan('2026-09-30'),
    result('2026-09-30', 'english:e1', 'know'),
    event('exercise.submitted', {
      localDay: '2026-09-30',
      trackId: 'english',
      itemId: 'english:ex-w1-a',
      payload: { kind: 'fill-blank', grade: 'pass' },
    }),
    checkIn('2026-09-30', 'english', 'done', 12),

    plan('2026-10-01'),
    toBeIgnored(result('2026-10-01', 'dsa:p4', 'maybe')),
    toBeIgnored(result('2026-10-01', 'dsa:nope', 'solved')),
    toBeIgnored(
      event('lesson.completed', { localDay: '2026-10-01', trackId: 'dsa', itemId: 'dsa:p4' }),
    ),
    result('2026-10-01', 'dsa:p4', 'failed'),
    checkIn('2026-10-01', 'dsa', 'done', 50),

    plan('2026-10-02'),
    result('2026-10-02', 'english:e2', 'know'),
    checkIn('2026-10-02', 'english', 'done', 8),
    event('track.paused', { localDay: '2026-10-03', trackId: 'english' }),

    // Week 2
    event('track.resumed', {
      localDay: '2026-10-08',
      trackId: 'english',
      payload: { pausedDays: 5 },
    }),
    plan('2026-10-08'),
    result('2026-10-08', 'dsa:p1', 'solved'),
    checkIn('2026-10-08', 'dsa', 'done', 30),
    event('settings.changed', { localDay: '2026-10-09', payload: { theme: 'dark' } }),
    result('2026-10-09', 'dsa:p2', 'solved'),

    // Week 3
    event('track.reset', { localDay: '2026-10-12', trackId: 'dsa' }),
    plan('2026-10-13'),
    result('2026-10-13', 'dsa:p1', 'solved'),
    checkIn('2026-10-13', 'dsa', 'done', 25),
    result('2026-10-15', 'english:e1', 'know'),
    event('prompt.completed', {
      localDay: '2026-10-16',
      trackId: 'english',
      itemId: 'english:prompt-w1',
    }),
    checkIn('2026-10-16', 'english', 'done', 15),
  ]
  return { events: deepFreeze(events), ignoredIds }
}

const fold = (events: readonly DomainEvent[]): DerivedState =>
  events.reduce((state, event) => project(state, event, CATALOG), EMPTY_DERIVED_STATE)

/** A copy of `events` in a deterministic random order. */
function shuffled<T>(events: readonly T[], seed: number): T[] {
  const random = mulberry32(seed)
  const copy = [...events]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    const a = copy[i] as T
    copy[i] = copy[j] as T
    copy[j] = a
  }
  return copy
}

describe('replay', () => {
  it('rebuilds three weeks of study exactly as folding project over the events', () => {
    const { events, ignoredIds } = threeWeeks()
    const { state, ignored } = replay(events, CATALOG)
    expect(state).toEqual(fold(events))

    expect(ignored).toEqual([
      { eventId: ignoredIds[0], reason: 'invalid_payload' },
      { eventId: ignoredIds[1], reason: 'unknown_item' },
      { eventId: ignoredIds[2], reason: 'wrong_type' },
    ])

    // The reset cleared DSA; only the problem studied after it is left, introduced again.
    expect(Object.keys(state.items).sort()).toEqual([
      'dsa:p1',
      'english:e1',
      'english:e2',
      'english:ex-w1-a',
      'english:prompt-w1',
    ])
    expect(state.items['dsa:p1']).toMatchObject({
      level: 1,
      dueOn: '2026-10-20',
      introducedOn: '2026-10-13',
      reps: 1,
    })
    // e1: L1 (09-28), partial L1 (09-29), L2 due 10-03 (09-30), resumed +5 → 10-08, L3 on 10-15.
    expect(state.items['english:e1']).toMatchObject({
      level: 3,
      status: 'strong',
      dueOn: '2026-10-22',
      introducedOn: MONDAY,
      lastResultOn: '2026-10-15',
      reps: 4,
    })
    // e2: weak L1 (09-28), L2 (09-29), L3 due 10-09 (10-02), shifted by the 5 paused days.
    expect(state.items['english:e2']).toMatchObject({
      level: 3,
      weak: false,
      lapses: 0,
      dueOn: '2026-10-14',
      reps: 3,
    })
    expect(state.items['english:ex-w1-a']).toMatchObject({ level: 0, dueOn: null, reps: 1 })

    // Check-ins and daily activity survive the reset.
    expect(Object.keys(state.blocks)).toHaveLength(10)
    expect(state.days[MONDAY]).toEqual({
      localDay: MONDAY,
      minutesByTrack: { dsa: 45, english: 15 },
      itemsDone: 4,
      completed: true,
    })
    // The skip is not an outcome; the wrong-type completion does not block the problem's result.
    expect(state.days['2026-09-29']?.itemsDone).toBe(3)
    expect(state.days['2026-10-01']).toEqual({
      localDay: '2026-10-01',
      minutesByTrack: { dsa: 50 },
      itemsDone: 1,
      completed: true,
    })
    expect(state.days['2026-10-09']).toEqual({
      localDay: '2026-10-09',
      minutesByTrack: {},
      itemsDone: 1,
      completed: false,
    })
  })

  it('does not depend on the input order', () => {
    const { events } = threeWeeks()
    const expected = replay(events, CATALOG)
    for (const seed of [1, 2, 3, 42, 2026]) {
      expect(replay(shuffled(events, seed), CATALOG)).toEqual(expected)
    }
  })

  it('orders by instant, not by the text of occurredAt, then by id', () => {
    const event = eventBuilder()
    const at = (occurredAt: string, id: string, result: string): DomainEvent => ({
      ...event('item.result', { trackId: 'dsa', itemId: 'dsa:p1', payload: { result } }),
      id,
      occurredAt,
    })
    // 09:00+07:00 is 02:00Z: it comes first although its text sorts after 05:00Z.
    const byInstant = replay(
      [
        at('2026-09-28T05:00:00Z', 'e-001', 'solved'),
        at('2026-09-28T09:00:00+07:00', 'e-002', 'failed'),
      ],
      CATALOG,
    )
    expect(byInstant.state.items['dsa:p1']).toMatchObject({ weak: true, lastResult: 'failed' })

    // The same instant written two ways: the id decides.
    const sameInstant = replay(
      [
        at('2026-09-28T02:00:00.000+00:00', 'e-002', 'failed'),
        at('2026-09-28T02:00:00Z', 'e-001', 'solved'),
      ],
      CATALOG,
    )
    expect(sameInstant.state.items['dsa:p1']).toMatchObject({ weak: false, lastResult: 'solved' })
  })

  it('does not let a completion of the wrong type block the day’s result', () => {
    const event = eventBuilder()
    const { state, ignored } = replay(
      [
        event('lesson.completed', { trackId: 'dsa', itemId: 'dsa:p1' }),
        event('item.result', { trackId: 'dsa', itemId: 'dsa:p1', payload: { result: 'solved' } }),
      ],
      CATALOG,
    )
    expect(ignored).toEqual([{ eventId: 'e-001', reason: 'wrong_type' }])
    expect(state.items['dsa:p1']).toMatchObject({ level: 1, lastResult: 'solved' })
    expect(state.days[MONDAY]?.itemsDone).toBe(1)
  })

  it('gives the empty state for no events', () => {
    expect(replay([], CATALOG)).toEqual({ state: EMPTY_DERIVED_STATE, ignored: [] })
  })

  it('replays only under the current rules version', () => {
    const { events } = threeWeeks()
    expect(replay(events, CATALOG, { rulesVersion: RULES_VERSION })).toEqual(
      replay(events, CATALOG),
    )
    expect(() => replay(events, CATALOG, { rulesVersion: RULES_VERSION - 1 })).toThrow(
      /rules version/,
    )
    expect(() => replay(events, CATALOG, { rulesVersion: RULES_VERSION + 1 })).toThrow(
      /rules version/,
    )
  })

  it('re-derives older events under the current rules and refuses a newer one', () => {
    const event = eventBuilder()
    const solved = event('item.result', {
      trackId: 'dsa',
      itemId: 'dsa:p1',
      payload: { result: 'solved' },
    })
    const older = { ...solved, rulesVersion: RULES_VERSION - 1 }
    expect(replay([older], CATALOG).state).toEqual(replay([solved], CATALOG).state)

    const newer = { ...solved, id: 'e-002', rulesVersion: RULES_VERSION + 1 }
    expect(() => replay([solved, newer], CATALOG)).toThrow(/rules version/)
  })

  it('refuses an event whose occurredAt is not a timestamp', () => {
    const event = eventBuilder()
    const broken = { ...event('settings.changed', { payload: { theme: 'dark' } }), occurredAt: 'x' }
    expect(() => replay([broken], CATALOG)).toThrow(/occurredAt/)
  })
})
