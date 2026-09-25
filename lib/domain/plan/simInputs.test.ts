import { describe, expect, it } from 'vitest'
import { RULES_VERSION } from '../rules'
import { DSA_TEMPLATE } from './__tests__/fixtures'
import { SIM_START_DATE, simCatalog, simEnrollment, type SimInputs } from './simInputs'

/** Two weeks of a DSA-like track; `arrays` is listed by both roadmaps, `dsa:p3` only as a recap. */
const INPUTS: SimInputs = Object.freeze<SimInputs>({
  rulesVersion: RULES_VERSION,
  trackId: 'dsa',
  srs: { intervals: [7, 21, 60], relearnDays: 3, masteredAfter: 2 },
  estimates: { lesson: 25, problem: { E: 20, M: 35, H: 50 } },
  review: { recallMinutes: 5, redoFactor: 0.6 },
  weeklyTemplate: DSA_TEMPLATE,
  defaults: { budgetMinutes: 60, newPerDay: null, throttle: [] },
  roadmaps: {
    '8w': {
      id: '8w',
      weeks: [
        {
          week: 1,
          topics: ['arrays', 'hashing'],
          core: ['dsa:p1', 'dsa:p2'],
          bonus: ['dsa:p4'],
          recap: [{ item: 'dsa:p3' }, { item: 'dsa:p1', mode: 'redo' }],
          decks: [],
        },
      ],
    },
    '10w': {
      id: '10w',
      weeks: [
        {
          week: 1,
          topics: ['arrays'],
          core: ['dsa:p1'],
          bonus: [],
          recap: [],
          decks: [],
        },
        {
          week: 2,
          topics: ['two-pointers'],
          core: ['dsa:p2'],
          bonus: [],
          recap: [{ item: 'dsa:p1', mode: 'explain-aloud' }],
          decks: [],
        },
      ],
    },
  },
  problems: {
    'dsa:p1': { difficulty: 'E', topic: 'arrays' },
    'dsa:p2': { difficulty: 'M', topic: 'hashing' },
    'dsa:p3': { difficulty: 'H', topic: 'arrays' },
    'dsa:p4': { difficulty: 'M', topic: 'two-pointers' },
  },
})

describe('simCatalog', () => {
  const catalog = simCatalog(INPUTS)
  const ofType = (itemType: string) =>
    Object.values(catalog.items)
      .filter((item) => item.itemType === itemType)
      .map((item) => item.id)
      .sort()

  it('has the track, with the inputs` template, defaults and roadmaps, and no decks', () => {
    expect(Object.keys(catalog.tracks)).toEqual(['dsa'])
    expect(catalog.tracks.dsa).toEqual({
      id: 'dsa',
      status: 'active',
      weeklyTemplate: INPUTS.weeklyTemplate,
      defaults: INPUTS.defaults,
      roadmaps: INPUTS.roadmaps,
    })
    expect(catalog.decks).toEqual({})
  })

  it('has one active pattern lesson per topic a roadmap week lists', () => {
    expect(ofType('lesson')).toEqual([
      'dsa:lesson-arrays',
      'dsa:lesson-hashing',
      'dsa:lesson-two-pointers',
    ])
    expect(catalog.items['dsa:lesson-hashing']).toMatchObject({
      trackId: 'dsa',
      topicId: 'hashing',
      status: 'active',
      srs: null,
      about: null,
      minutes: { new: 25, review: 25, recall: 25, redo: 25, 'explain-aloud': 25 },
    })
  })

  it('has every listed problem, active, with its difficulty`s minutes', () => {
    expect(ofType('problem')).toEqual(['dsa:p1', 'dsa:p2', 'dsa:p3', 'dsa:p4'])
    expect(catalog.items['dsa:p2']).toMatchObject({
      trackId: 'dsa',
      topicId: 'hashing',
      status: 'active',
      srs: INPUTS.srs,
      difficulty: 'M',
      reviewModes: true,
      deepDiveId: null,
      minutes: { new: 35, redo: 21, recall: 5, review: 5, 'explain-aloud': 5 },
    })
    expect(catalog.items['dsa:p1']?.minutes).toMatchObject({ new: 20, redo: 12 })
    expect(catalog.items['dsa:p3']?.minutes).toMatchObject({ new: 50, redo: 30 })
  })

  it('has one repeatable prompt per practice tag, with its block`s minutes', () => {
    expect(ofType('prompt')).toEqual(['dsa:prompt-mock-interview'])
    expect(catalog.items['dsa:prompt-mock-interview']).toMatchObject({
      tag: 'mock-interview',
      repeatable: true,
      status: 'active',
      srs: null,
      week: null,
      minutes: { new: 45, review: 45 },
    })
  })

  it('makes no prompt for the shadowing tag or an itemType block', () => {
    const catalogWithCards = simCatalog({
      ...INPUTS,
      weeklyTemplate: {
        'mon-fri': [
          { kind: 'practice', itemType: 'exercise', minutes: 5 },
          { kind: 'practice', tag: 'shadowing', minutes: 3 },
          { kind: 'new' },
        ],
      },
    })
    expect(
      Object.values(catalogWithCards.items).filter((item) => item.itemType === 'prompt'),
    ).toEqual([])
  })

  it('throws when a roadmap lists a problem the inputs do not describe', () => {
    const problems = Object.fromEntries(
      Object.entries(INPUTS.problems).filter(([id]) => id !== 'dsa:p4'),
    )
    expect(() => simCatalog({ ...INPUTS, problems })).toThrow(/dsa:p4/)
  })
})

describe('simEnrollment', () => {
  it('uses the defaults with the given variant and budget', () => {
    expect(simEnrollment(INPUTS, '10w', 90)).toEqual({
      trackId: 'dsa',
      variant: '10w',
      status: 'active',
      startDate: SIM_START_DATE,
      budgetMinutes: 90,
      newPerDay: null,
      throttle: [],
      weeklyTemplate: INPUTS.weeklyTemplate,
      includeBonus: false,
      resetOn: null,
    })
  })

  it('starts on a Monday, the simulations` day 0', () => {
    expect(SIM_START_DATE).toBe('2026-09-28')
  })
})
