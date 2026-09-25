import { describe, expect, it } from 'vitest'
import type { PlanCatalog } from '../catalog'
import type { EventType } from '../events'
import {
  CATALOG,
  ENGLISH_SRS,
  itemState,
  MONDAY,
  statesOf,
  withItems,
} from '../plan/__tests__/fixtures'
import { RULES_VERSION } from '../rules'
import { EMPTY_DERIVED_STATE, type BlockState, type DerivedState, type ItemState } from '../state'
import type { LocalDay } from '../time/localDay'
import { deepFreeze, eventBuilder, type EventBuilder, type EventFields } from './__tests__/events'
import { project, projectEvent, type DomainEvent, type IgnoreReason } from './project'

const TUESDAY: LocalDay = '2026-09-29'
const WEDNESDAY: LocalDay = '2026-09-30'

/** Folds `project` over `events`, starting from `state`. */
const projectAll = (
  events: readonly DomainEvent[],
  state: DerivedState = EMPTY_DERIVED_STATE,
): DerivedState => events.reduce((current, event) => project(current, event, CATALOG), state)

/** A frozen state holding `items` only. */
const withStates = (...items: readonly ItemState[]): DerivedState =>
  deepFreeze({ ...EMPTY_DERIVED_STATE, items: statesOf(...items) })

/** A state other events could change, for the "ignored" cases. */
const STUDIED = withStates(
  itemState('dsa:p1', MONDAY, { dueOn: '2026-10-05' }),
  itemState('english:e1', MONDAY, { dueOn: TUESDAY }),
)

type IgnoredCase = [
  name: string,
  type: EventType,
  fields: EventFields,
  reason: IgnoreReason,
  catalog?: PlanCatalog,
]

/** Each case leaves `STUDIED` as the very same object and reports `reason`. */
function expectIgnored([, type, fields, reason, catalog = CATALOG]: IgnoredCase): void {
  const event = eventBuilder()
  const result = projectEvent(STUDIED, event(type, fields), catalog)
  expect(result.ignored).toBe(reason)
  expect(result.state).toBe(STUDIED)
}

describe('item.result', () => {
  const event = eventBuilder()
  const solved = event('item.result', {
    trackId: 'dsa',
    itemId: 'dsa:p1',
    payload: { result: 'solved' },
  })

  it('starts SRS, introduces the item with its catalog fields and counts the day', () => {
    const { state, ignored } = projectEvent(EMPTY_DERIVED_STATE, solved, CATALOG)
    expect(ignored).toBeNull()
    expect(state.items).toEqual({
      'dsa:p1': {
        itemId: 'dsa:p1',
        trackId: 'dsa',
        topicId: 'arrays',
        itemType: 'problem',
        level: 1,
        weak: false,
        topSuccesses: 0,
        status: 'ok',
        dueOn: '2026-10-05',
        lastResult: 'solved',
        lastResultOn: MONDAY,
        introducedOn: MONDAY,
        lapses: 0,
        reps: 1,
      },
    })
    expect(state.days).toEqual({
      [MONDAY]: { localDay: MONDAY, minutesByTrack: {}, itemsDone: 1, completed: false },
    })
    expect(state.blocks).toEqual({})
  })

  it('counts only the first result per item per day: a second one changes nothing', () => {
    const first = deepFreeze(project(EMPTY_DERIVED_STATE, solved, CATALOG))
    const failed = event('item.result', {
      trackId: 'dsa',
      itemId: 'dsa:p1',
      payload: { result: 'failed' },
    })
    const second = projectEvent(first, failed, CATALOG)
    expect(second.state).toBe(first)
    expect(second.ignored).toBeNull()
    expect(second.state.items['dsa:p1']?.lastResult).toBe('solved')
    expect(second.state.days[MONDAY]?.itemsDone).toBe(1)

    // Another item the same day is another item done.
    const other = project(
      first,
      event('item.result', { trackId: 'dsa', itemId: 'dsa:p2', payload: { result: 'hint' } }),
      CATALOG,
    )
    expect(other.days[MONDAY]?.itemsDone).toBe(2)
  })

  it('builds on the existing row on a later day and keeps its introducedOn', () => {
    const later = projectAll([
      solved,
      event('item.result', {
        localDay: '2026-10-05',
        trackId: 'dsa',
        itemId: 'dsa:p1',
        payload: { result: 'solved', mode: 'recall' },
      }),
    ])
    expect(later.items['dsa:p1']).toEqual(
      itemState('dsa:p1', MONDAY, {
        level: 2,
        dueOn: '2026-10-26',
        lastResultOn: '2026-10-05',
        reps: 2,
      }),
    )
    expect(later.days['2026-10-05']?.itemsDone).toBe(1)
  })

  it("uses the card's SRS parameters for a card", () => {
    const state = project(
      EMPTY_DERIVED_STATE,
      event('item.result', {
        trackId: 'english',
        itemId: 'english:e1',
        payload: { result: 'know' },
      }),
      CATALOG,
    )
    expect(state.items['english:e1']).toMatchObject({
      level: 1,
      dueOn: TUESDAY,
      topicId: 'standup',
      itemType: 'flashcard',
      lastResult: 'know',
    })
  })

  it.each<IgnoredCase>([
    [
      'a completion-only item',
      'item.result',
      { itemId: 'dsa:lesson-arrays', payload: { result: 'solved' } },
      'not_srs',
    ],
    [
      'an item not in the catalog',
      'item.result',
      { itemId: 'dsa:nope', payload: { result: 'solved' } },
      'unknown_item',
    ],
    [
      'an inherited property name',
      'item.result',
      { itemId: 'constructor', payload: { result: 'solved' } },
      'unknown_item',
    ],
    ['no itemId', 'item.result', { payload: { result: 'solved' } }, 'missing_keys'],
    [
      'an invalid payload',
      'item.result',
      { itemId: 'dsa:p1', payload: { result: 'maybe' } },
      'invalid_payload',
    ],
  ])('ignores %s', (...ignoredCase) => expectIgnored(ignoredCase))
})

describe('lesson.completed, exercise.submitted and prompt.completed', () => {
  const completions = (
    event: EventBuilder,
    localDay: LocalDay,
    grade: 'pass' | 'close' | 'miss',
  ): readonly DomainEvent[] => [
    event('lesson.completed', {
      localDay,
      trackId: 'dsa',
      itemId: 'dsa:lesson-arrays',
      payload: { quizScore: 80 },
    }),
    event('exercise.submitted', {
      localDay,
      trackId: 'english',
      itemId: 'english:ex-w1-a',
      payload: { kind: 'fill-blank', grade },
    }),
    event('prompt.completed', { localDay, trackId: 'english', itemId: 'english:prompt-w1' }),
  ]

  it('give completion-only items a level-0 row and count the day', () => {
    const state = projectAll(completions(eventBuilder(), MONDAY, 'close'))
    expect(state.items['dsa:lesson-arrays']).toEqual({
      itemId: 'dsa:lesson-arrays',
      trackId: 'dsa',
      topicId: 'arrays',
      itemType: 'lesson',
      level: 0,
      weak: false,
      topSuccesses: 0,
      status: 'ok',
      dueOn: null,
      lastResult: 'completed',
      lastResultOn: MONDAY,
      introducedOn: MONDAY,
      lapses: 0,
      reps: 1,
    })
    expect(state.items).toEqual(
      statesOf(
        itemState('dsa:lesson-arrays', MONDAY),
        itemState('english:ex-w1-a', MONDAY, { lastResult: 'close' }),
        itemState('english:prompt-w1', MONDAY, { lastResult: 'completed' }),
      ),
    )
    expect(state.days[MONDAY]?.itemsDone).toBe(3)
  })

  it('count once per item per day, and again on the next day', () => {
    const event = eventBuilder()
    const monday = deepFreeze(projectAll(completions(event, MONDAY, 'close')))
    expect(projectAll(completions(event, MONDAY, 'pass'), monday)).toBe(monday)

    const tuesday = projectAll(completions(event, TUESDAY, 'pass'), monday)
    expect(tuesday.items).toEqual(
      statesOf(
        itemState('dsa:lesson-arrays', MONDAY, { lastResultOn: TUESDAY, reps: 2 }),
        itemState('english:ex-w1-a', MONDAY, {
          lastResult: 'pass',
          lastResultOn: TUESDAY,
          reps: 2,
        }),
        itemState('english:prompt-w1', MONDAY, { lastResultOn: TUESDAY, reps: 2 }),
      ),
    )
    expect(tuesday.days[MONDAY]?.itemsDone).toBe(3)
    expect(tuesday.days[TUESDAY]?.itemsDone).toBe(3)
  })

  it('turn a skipped item into a completed one, introduced on the skip day', () => {
    const event = eventBuilder()
    const state = projectAll([
      event('item.skipped', { trackId: 'dsa', itemId: 'dsa:lesson-arrays' }),
      event('lesson.completed', {
        localDay: TUESDAY,
        trackId: 'dsa',
        itemId: 'dsa:lesson-arrays',
      }),
    ])
    expect(state.items['dsa:lesson-arrays']).toEqual(
      itemState('dsa:lesson-arrays', MONDAY, { lastResultOn: TUESDAY }),
    )
  })

  it.each<IgnoredCase>([
    ['a lesson.completed naming a problem', 'lesson.completed', { itemId: 'dsa:p1' }, 'wrong_type'],
    [
      'an exercise.submitted naming a lesson',
      'exercise.submitted',
      { itemId: 'dsa:lesson-arrays', payload: { kind: 'fill-blank', grade: 'pass' } },
      'wrong_type',
    ],
    [
      'a prompt.completed naming a card',
      'prompt.completed',
      { itemId: 'english:e1' },
      'wrong_type',
    ],
    [
      'a prompt.completed naming a prompt with SRS',
      'prompt.completed',
      { itemId: 'english:prompt-w1' },
      'wrong_type',
      withItems(CATALOG, { 'english:prompt-w1': { srs: ENGLISH_SRS } }),
    ],
    [
      'an item not in the catalog',
      'lesson.completed',
      { itemId: 'dsa:lesson-nope' },
      'unknown_item',
    ],
    [
      'no itemId',
      'exercise.submitted',
      { payload: { kind: 'fill-blank', grade: 'pass' } },
      'missing_keys',
    ],
    [
      'an invalid payload',
      'exercise.submitted',
      { itemId: 'english:ex-w1-a', payload: { kind: '', grade: 'pass' } },
      'invalid_payload',
    ],
  ])('ignore %s', (...ignoredCase) => expectIgnored(ignoredCase))
})

describe('item.skipped', () => {
  it('introduces a new item as skipped, outside SRS, without counting the day', () => {
    const event = eventBuilder()
    const state = project(
      EMPTY_DERIVED_STATE,
      event('item.skipped', { trackId: 'dsa', itemId: 'dsa:p2' }),
      CATALOG,
    )
    expect(state.items).toEqual({
      'dsa:p2': {
        itemId: 'dsa:p2',
        trackId: 'dsa',
        topicId: 'arrays',
        itemType: 'problem',
        level: 0,
        weak: false,
        topSuccesses: 0,
        status: 'skipped',
        dueOn: null,
        lastResult: null,
        lastResultOn: null,
        introducedOn: MONDAY,
        lapses: 0,
        reps: 0,
      },
    })
    expect(state.days).toEqual({})
  })

  it('then a result starts SRS at level 1 and keeps the skip day as introducedOn', () => {
    const event = eventBuilder()
    const state = projectAll([
      event('item.skipped', { trackId: 'dsa', itemId: 'dsa:p2' }),
      event('item.result', {
        localDay: WEDNESDAY,
        trackId: 'dsa',
        itemId: 'dsa:p2',
        payload: { result: 'hint' },
      }),
    ])
    expect(state.items['dsa:p2']).toEqual(
      itemState('dsa:p2', MONDAY, {
        dueOn: '2026-10-07',
        lastResult: 'hint',
        lastResultOn: WEDNESDAY,
      }),
    )
    expect(state.days).toEqual({
      [WEDNESDAY]: { localDay: WEDNESDAY, minutesByTrack: {}, itemsDone: 1, completed: false },
    })
  })

  it('does not use up the day: a result on the skip day still counts', () => {
    const event = eventBuilder()
    const state = projectAll([
      event('item.skipped', { trackId: 'dsa', itemId: 'dsa:p2' }),
      event('item.result', { trackId: 'dsa', itemId: 'dsa:p2', payload: { result: 'failed' } }),
    ])
    expect(state.items['dsa:p2']).toMatchObject({ level: 1, weak: true, status: 'weak' })
    expect(state.days[MONDAY]?.itemsDone).toBe(1)
  })

  it('takes an item in SRS out of the schedule and keeps everything else', () => {
    const event = eventBuilder()
    const row = itemState('dsa:p1', MONDAY, { level: 2, dueOn: '2026-10-26', reps: 2 })
    const state = project(
      withStates(row),
      event('item.skipped', { localDay: '2026-10-06', trackId: 'dsa', itemId: 'dsa:p1' }),
      CATALOG,
    )
    expect(state.items['dsa:p1']).toEqual({ ...row, status: 'skipped', dueOn: null })
  })

  it.each<IgnoredCase>([
    ['an item not in the catalog', 'item.skipped', { itemId: 'dsa:nope' }, 'unknown_item'],
    ['no itemId', 'item.skipped', {}, 'missing_keys'],
    [
      'an invalid payload',
      'item.skipped',
      { itemId: 'dsa:p2', payload: { why: 'x' } },
      'invalid_payload',
    ],
  ])('ignores %s', (...ignoredCase) => expectIgnored(ignoredCase))
})

describe('item.readded', () => {
  const mastered = itemState('dsa:p1', MONDAY, {
    level: 3,
    topSuccesses: 2,
    status: 'mastered',
    dueOn: null,
    lastResultOn: '2026-12-01',
    reps: 5,
  })

  it('puts a mastered item back at the top level, due that day', () => {
    const event = eventBuilder()
    const before = withStates(mastered)
    const { state, ignored } = projectEvent(
      before,
      event('item.readded', { localDay: '2027-01-10', trackId: 'dsa', itemId: 'dsa:p1' }),
      CATALOG,
    )
    expect(ignored).toBeNull()
    expect(state.items['dsa:p1']).toEqual({
      ...mastered,
      level: 3,
      topSuccesses: 0,
      status: 'strong',
      dueOn: '2027-01-10',
    })
    expect(state.days).toBe(before.days)
  })

  it('leaves an item that is not mastered alone', () => {
    const event = eventBuilder()
    const result = projectEvent(
      STUDIED,
      event('item.readded', { trackId: 'dsa', itemId: 'dsa:p1' }),
      CATALOG,
    )
    expect(result).toEqual({ state: STUDIED, ignored: null })
    expect(result.state).toBe(STUDIED)
  })

  it.each<IgnoredCase>([
    ['an item with no row', 'item.readded', { itemId: 'dsa:p4' }, 'unknown_item'],
    ['an item not in the catalog', 'item.readded', { itemId: 'dsa:nope' }, 'unknown_item'],
    ['a completion-only item', 'item.readded', { itemId: 'dsa:lesson-arrays' }, 'not_srs'],
    ['no itemId', 'item.readded', {}, 'missing_keys'],
  ])('ignores %s', (...ignoredCase) => expectIgnored(ignoredCase))
})

describe('item.snapshot', () => {
  const snapshot = {
    level: 2,
    weak: true,
    topSuccesses: 0,
    dueOn: '2026-10-20',
    lapses: 1,
    reps: 4,
    introducedOn: '2026-08-03',
    lastResult: 'failed',
    lastResultOn: '2026-10-17',
    rulesVersion: RULES_VERSION,
  }

  it("replaces the row with exactly the payload's fields and the derived status", () => {
    const event = eventBuilder()
    const before = withStates(itemState('dsa:p3', MONDAY, { level: 3, reps: 9 }))
    const { state, ignored } = projectEvent(
      before,
      event('item.snapshot', { trackId: 'dsa', itemId: 'dsa:p3', payload: snapshot }),
      CATALOG,
    )
    expect(ignored).toBeNull()
    expect(state.items['dsa:p3']).toEqual({
      itemId: 'dsa:p3',
      trackId: 'dsa',
      topicId: 'arrays',
      itemType: 'problem',
      level: 2,
      weak: true,
      topSuccesses: 0,
      status: 'weak',
      dueOn: '2026-10-20',
      lastResult: 'failed',
      lastResultOn: '2026-10-17',
      introducedOn: '2026-08-03',
      lapses: 1,
      reps: 4,
    })
    expect(state.days).toBe(before.days)
  })

  it.each([
    ['mastered', 'dsa:p1', { level: 3, weak: false, topSuccesses: 2, dueOn: null }],
    ['strong', 'dsa:p1', { level: 3, weak: false, topSuccesses: 0 }],
    ['ok', 'dsa:p1', { level: 1, weak: false }],
    ['ok', 'dsa:p1', { level: 0, weak: false, dueOn: null }],
    ['ok', 'dsa:lesson-arrays', { level: 0, weak: false, dueOn: null, lastResult: 'completed' }],
  ] as const)('derives status %s for %s %o', (status, itemId, fields) => {
    const event = eventBuilder()
    const state = project(
      EMPTY_DERIVED_STATE,
      event('item.snapshot', { itemId, payload: { ...snapshot, ...fields } }),
      CATALOG,
    )
    expect(state.items[itemId]).toMatchObject({ ...fields, status })
  })

  it.each<IgnoredCase>([
    [
      'an item not in the catalog',
      'item.snapshot',
      { itemId: 'dsa:nope', payload: snapshot },
      'unknown_item',
    ],
    ['no itemId', 'item.snapshot', { payload: snapshot }, 'missing_keys'],
    [
      'a snapshot without introducedOn',
      'item.snapshot',
      { itemId: 'dsa:p1', payload: { ...snapshot, introducedOn: undefined } },
      'invalid_payload',
    ],
  ])('ignores %s', (...ignoredCase) => expectIgnored(ignoredCase))
})

describe('block.checked_in', () => {
  const checkIn = (
    event: EventBuilder,
    blockId: string,
    trackId: string,
    payload: Record<string, unknown>,
    localDay: LocalDay = MONDAY,
  ): DomainEvent =>
    event('block.checked_in', { localDay, planId: 'plan-1', blockId, trackId, payload })

  const block = (change: Partial<BlockState>): BlockState => ({
    planId: 'plan-1',
    blockId: 'dsa:new:1',
    trackId: 'dsa',
    status: 'done',
    minutes: 30,
    note: null,
    auto: false,
    checkedInOn: MONDAY,
    ...change,
  })

  /** A DSA block done in 30 minutes and an English block partly done in 10, both on Monday. */
  const monday = (event: EventBuilder): DerivedState =>
    deepFreeze(
      projectAll([
        checkIn(event, 'dsa:new:1', 'dsa', { status: 'done', minutes: 30 }),
        checkIn(event, 'english:review:1', 'english', {
          status: 'partial',
          minutes: 10,
          note: 'Mệt',
          auto: true,
        }),
      ]),
    )

  it('sums the minutes per track of the blocks checked in that day', () => {
    const state = monday(eventBuilder())
    expect(state.blocks).toEqual({
      'plan-1/dsa:new:1': block({}),
      'plan-1/english:review:1': block({
        blockId: 'english:review:1',
        trackId: 'english',
        status: 'partial',
        minutes: 10,
        note: 'Mệt',
        auto: true,
      }),
    })
    expect(state.days).toEqual({
      [MONDAY]: {
        localDay: MONDAY,
        minutesByTrack: { dsa: 30, english: 10 },
        itemsDone: 0,
        completed: true,
      },
    })
  })

  it('replaces an edited block and recomputes the day it was first checked in', () => {
    const event = eventBuilder()
    const edited = project(
      monday(event),
      checkIn(event, 'dsa:new:1', 'dsa', { status: 'skipped', minutes: 0 }, TUESDAY),
      CATALOG,
    )
    expect(edited.blocks['plan-1/dsa:new:1']).toEqual(block({ status: 'skipped', minutes: 0 }))
    expect(edited.days).toEqual({
      [MONDAY]: {
        localDay: MONDAY,
        minutesByTrack: { dsa: 0, english: 10 },
        itemsDone: 0,
        completed: true,
      },
    })

    // An edit that leaves out the note and the auto flag clears them.
    const again = project(
      edited,
      checkIn(event, 'english:review:1', 'english', { status: 'done', minutes: 12 }, TUESDAY),
      CATALOG,
    )
    expect(again.blocks['plan-1/english:review:1']).toEqual(
      block({ blockId: 'english:review:1', trackId: 'english', minutes: 12 }),
    )
    expect(again.days[MONDAY]?.minutesByTrack).toEqual({ dsa: 0, english: 12 })
  })

  it('leaves a day with only skipped blocks not completed', () => {
    const event = eventBuilder()
    const state = projectAll([
      checkIn(event, 'dsa:new:1', 'dsa', { status: 'skipped', minutes: 0 }),
      checkIn(event, 'english:review:1', 'english', { status: 'skipped', minutes: 0 }),
    ])
    expect(state.days[MONDAY]).toEqual({
      localDay: MONDAY,
      minutesByTrack: { dsa: 0, english: 0 },
      itemsDone: 0,
      completed: false,
    })
  })

  it("keeps the day's itemsDone", () => {
    const event = eventBuilder()
    const state = projectAll([
      event('item.result', { trackId: 'dsa', itemId: 'dsa:p1', payload: { result: 'solved' } }),
      checkIn(event, 'dsa:new:1', 'dsa', { status: 'done', minutes: 30 }),
    ])
    expect(state.days[MONDAY]).toEqual({
      localDay: MONDAY,
      minutesByTrack: { dsa: 30 },
      itemsDone: 1,
      completed: true,
    })
  })

  const done = { status: 'done', minutes: 30 }
  it.each<IgnoredCase>([
    [
      'no planId',
      'block.checked_in',
      { blockId: 'b', trackId: 'dsa', payload: done },
      'missing_keys',
    ],
    [
      'no blockId',
      'block.checked_in',
      { planId: 'p', trackId: 'dsa', payload: done },
      'missing_keys',
    ],
    [
      'no trackId',
      'block.checked_in',
      { planId: 'p', blockId: 'b', payload: done },
      'missing_keys',
    ],
    [
      'an invalid payload',
      'block.checked_in',
      { planId: 'p', blockId: 'b', trackId: 'dsa', payload: { status: 'done', minutes: 601 } },
      'invalid_payload',
    ],
  ])('ignores %s', (...ignoredCase) => expectIgnored(ignoredCase))
})

describe('track.reset and track.resumed', () => {
  const studied: DerivedState = deepFreeze({
    items: statesOf(
      itemState('dsa:p1', MONDAY, { dueOn: '2026-10-05' }),
      itemState('dsa:lesson-arrays', MONDAY),
      itemState('dsa:p2', MONDAY, { level: 0, status: 'skipped', dueOn: null, reps: 0 }),
      itemState('english:e1', MONDAY, { dueOn: TUESDAY }),
    ),
    blocks: {
      'plan-1/dsa:new:1': {
        planId: 'plan-1',
        blockId: 'dsa:new:1',
        trackId: 'dsa',
        status: 'done',
        minutes: 30,
        note: null,
        auto: false,
        checkedInOn: MONDAY,
      },
    },
    days: {
      [MONDAY]: { localDay: MONDAY, minutesByTrack: { dsa: 30 }, itemsDone: 3, completed: true },
    },
  })

  it("track.reset removes only that track's items; blocks and days stay", () => {
    const event = eventBuilder()
    const { state, ignored } = projectEvent(
      studied,
      event('track.reset', { localDay: TUESDAY, trackId: 'dsa' }),
      CATALOG,
    )
    expect(ignored).toBeNull()
    expect(state.items).toEqual({ 'english:e1': studied.items['english:e1'] })
    expect(state.blocks).toBe(studied.blocks)
    expect(state.days).toBe(studied.days)
  })

  it("track.resumed shifts the track's due dates by pausedDays", () => {
    const event = eventBuilder()
    const state = project(
      studied,
      event('track.resumed', { localDay: TUESDAY, trackId: 'dsa', payload: { pausedDays: 5 } }),
      CATALOG,
    )
    expect(state.items).toEqual({
      ...studied.items,
      'dsa:p1': itemState('dsa:p1', MONDAY, { dueOn: '2026-10-10' }),
    })
    expect(state.items['english:e1']).toBe(studied.items['english:e1'])
    expect(state.blocks).toBe(studied.blocks)
    expect(state.days).toBe(studied.days)
  })

  it.each<IgnoredCase>([
    ['a reset with no trackId', 'track.reset', {}, 'missing_keys'],
    ['a resume with no trackId', 'track.resumed', { payload: { pausedDays: 5 } }, 'missing_keys'],
    [
      'a resume with an invalid payload',
      'track.resumed',
      { trackId: 'dsa', payload: { pausedDays: -1 } },
      'invalid_payload',
    ],
  ])('ignores %s', (...ignoredCase) => expectIgnored(ignoredCase))
})

describe('events that never touch derived state', () => {
  it.each<[EventType, EventFields]>([
    [
      'schedule.changed',
      {
        payload: {
          timezone: 'Asia/Ho_Chi_Minh',
          dayStartsAt: '04:00',
          effectiveAt: '2026-09-29T04:00:00+07:00',
        },
      },
    ],
    ['settings.changed', { payload: { theme: 'dark' } }],
    ['plan.generated', { planId: 'plan-1', payload: { mode: 'baseline', planVersion: 1 } }],
    ['admin.user_approved', { payload: { from: 'pending', to: 'active' } }],
    [
      'track.enrolled',
      { trackId: 'dsa', payload: { roadmapVariant: '8w', budgetMinutes: 60, startDate: MONDAY } },
    ],
    ['track.paused', { trackId: 'dsa' }],
    ['track.removed', { trackId: 'dsa' }],
    // Not checked either: nothing it could change.
    ['settings.changed', { payload: {} }],
  ])('%s returns the same state and ignored: null (%o)', (type, fields) => {
    const event = eventBuilder()
    const result = projectEvent(STUDIED, event(type, fields), CATALOG)
    expect(result.state).toBe(STUDIED)
    expect(result.ignored).toBeNull()
  })
})

describe('purity', () => {
  it('never modifies a deep-frozen state, event or catalog', () => {
    const catalog = deepFreeze(structuredClone(CATALOG))
    const state: DerivedState = deepFreeze({
      items: statesOf(
        itemState('dsa:p1', MONDAY, { dueOn: '2026-10-05' }),
        itemState('dsa:p2', MONDAY, { level: 0, status: 'skipped', dueOn: null, reps: 0 }),
        itemState('dsa:p4', MONDAY, { level: 3, topSuccesses: 2, status: 'mastered' }),
        itemState('dsa:lesson-arrays', MONDAY),
        itemState('english:e1', MONDAY, { dueOn: TUESDAY }),
      ),
      blocks: {
        'plan-1/dsa:new:1': {
          planId: 'plan-1',
          blockId: 'dsa:new:1',
          trackId: 'dsa',
          status: 'done',
          minutes: 30,
          note: null,
          auto: false,
          checkedInOn: MONDAY,
        },
      },
      days: {
        [MONDAY]: { localDay: MONDAY, minutesByTrack: { dsa: 30 }, itemsDone: 2, completed: true },
      },
    })
    const before = structuredClone(state)
    const event = eventBuilder()
    const on = { localDay: TUESDAY }
    const events = [
      event('item.result', { ...on, itemId: 'dsa:p1', payload: { result: 'solved' } }),
      event('item.result', { ...on, itemId: 'dsa:p2', payload: { result: 'failed' } }),
      event('item.result', { ...on, itemId: 'english:e2', payload: { result: 'know' } }),
      event('lesson.completed', { ...on, itemId: 'dsa:lesson-arrays' }),
      event('lesson.completed', { ...on, itemId: 'dsa:lesson-two-pointers' }),
      event('exercise.submitted', {
        ...on,
        itemId: 'english:ex-w1-a',
        payload: { kind: 'fill-blank', grade: 'miss' },
      }),
      event('prompt.completed', { ...on, itemId: 'dsa:prompt-mock' }),
      event('item.skipped', { ...on, itemId: 'english:e1' }),
      event('item.skipped', { ...on, itemId: 'dsa:p5' }),
      event('item.readded', { ...on, itemId: 'dsa:p4' }),
      event('item.snapshot', {
        ...on,
        itemId: 'dsa:p1',
        payload: {
          level: 2,
          weak: false,
          topSuccesses: 0,
          dueOn: '2026-10-20',
          lapses: 0,
          reps: 2,
          introducedOn: MONDAY,
          lastResult: 'solved',
          lastResultOn: TUESDAY,
          rulesVersion: RULES_VERSION,
        },
      }),
      event('block.checked_in', {
        ...on,
        planId: 'plan-1',
        blockId: 'dsa:new:1',
        trackId: 'dsa',
        payload: { status: 'partial', minutes: 20 },
      }),
      event('block.checked_in', {
        ...on,
        planId: 'plan-2',
        blockId: 'english:new:1',
        trackId: 'english',
        payload: { status: 'done', minutes: 15 },
      }),
      event('track.resumed', { ...on, trackId: 'dsa', payload: { pausedDays: 3 } }),
      event('track.reset', { ...on, trackId: 'english' }),
      event('settings.changed', { ...on, payload: { theme: 'dark' } }),
    ]

    // Each event on the frozen state, and all of them folded (every step frozen in turn).
    for (const each of events) expect(() => projectEvent(state, each, catalog)).not.toThrow()
    const folded = events.reduce(
      (current, each) => deepFreeze(project(current, each, catalog)),
      state,
    )
    expect(state).toEqual(before)
    expect(folded.items['english:e1']).toBeUndefined()
    expect(folded.days[TUESDAY]?.itemsDone).toBe(7)
  })
})

describe('project', () => {
  it('is projectEvent(...).state', () => {
    const event = eventBuilder()
    const solved = event('item.result', { itemId: 'dsa:p1', payload: { result: 'solved' } })
    expect(project(EMPTY_DERIVED_STATE, solved, CATALOG)).toEqual(
      projectEvent(EMPTY_DERIVED_STATE, solved, CATALOG).state,
    )
  })
})
