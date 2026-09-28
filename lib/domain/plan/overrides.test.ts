import { describe, expect, it } from 'vitest'
import type { PlanRoadmapWeek } from '../catalog'
import { addDays } from '../time/localDay'
import expiry from './__tests__/override-expiry.fixtures.json'
import {
  customCard,
  LAB_CATALOG,
  LAB_ROADMAP,
  LAB_TRACK,
  labCatalogWith,
  labEnrollment,
  labStates,
} from './__tests__/overrideFixtures'
import { itemState, MONDAY } from './__tests__/fixtures'
import {
  effectiveRoadmap,
  OVERRIDE_LIMITS,
  overrideActive,
  overrideParamsSchemas,
  reorderable,
  type RoadmapOverride,
  upcomingTopics,
  validateOverride,
  type ValidationContext,
} from './overrides'
import { coreItemsOfWeek, newQueue, roadmapWeek } from './roadmap'

const reorder = (
  order: readonly string[],
  key = 'ro',
  startLocalDay = MONDAY,
): RoadmapOverride => ({
  trackId: 'dsa',
  key,
  kind: 'reorder_topics',
  params: { order },
  startLocalDay,
})

const insertBlock = (
  params: Partial<Extract<RoadmapOverride, { kind: 'insert_block' }>['params']> = {},
): RoadmapOverride => ({
  trackId: 'dsa',
  key: 'ib',
  kind: 'insert_block',
  params: {
    topicId: 'arrays',
    weekdays: ['mon', 'wed'],
    minutes: 15,
    until: '2026-10-05',
    ...params,
  },
  startLocalDay: MONDAY,
})

const extraWeek = (topicId = 'arrays', studyDays = 5): RoadmapOverride => ({
  trackId: 'dsa',
  key: 'ew',
  kind: 'extra_week',
  params: { topicId, studyDays },
  startLocalDay: MONDAY,
  usedDays: 0,
})

/** Every upcoming topic of a learner in week 1 (arrays started), heap moved before linked-list. */
const HEAP_FIRST = ['two-pointers', 'heap', 'linked-list', 'trees', 'graphs', 'tries']

const summary = (weeks: readonly PlanRoadmapWeek[]) =>
  weeks.map((week) => ({ week: week.week, topics: week.topics, core: week.core }))

// ---------------------------------------------------------------------------------------------
// overrideActive — decision 18, the fixtures 6.2b's pgTAP repeats
// ---------------------------------------------------------------------------------------------

describe('overrideActive (decision 18; shared fixtures with 6.2b)', () => {
  it('has fixtures for every kind', () => {
    const kinds = new Set(expiry.rows.map((row) => row.override.kind))
    expect([...kinds].sort()).toEqual(['extra_week', 'insert_block', 'reorder_topics'])
  })

  it.each(expiry.rows)('$name → $active', (row) => {
    expect(overrideActive(row.override as RoadmapOverride, row.today)).toBe(row.active)
  })

  it('every fixture override has valid params', () => {
    for (const row of expiry.rows) {
      const override = row.override as RoadmapOverride
      expect(overrideParamsSchemas[override.kind].safeParse(override.params).success).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------------------------
// effectiveRoadmap — §5.12, decision 35
// ---------------------------------------------------------------------------------------------

describe('effectiveRoadmap (§5.12, decision 35)', () => {
  const items = labStates(['dsa:a1'])

  it('no reorder → the roadmap itself (same object: baseline plans are unchanged)', () => {
    for (const overrides of [[], [insertBlock()], [extraWeek()]]) {
      expect(effectiveRoadmap(LAB_ROADMAP, LAB_TRACK, overrides, LAB_CATALOG, items)).toBe(
        LAB_ROADMAP,
      )
    }
  })

  it("another track's reorder does not apply", () => {
    const other = { ...reorder(HEAP_FIRST), trackId: 'english' }
    expect(effectiveRoadmap(LAB_ROADMAP, LAB_TRACK, [other], LAB_CATALOG, items)).toBe(LAB_ROADMAP)
  })

  it('refills the weeks from the first not-started topic on, in the new order, keeping counts', () => {
    const effective = effectiveRoadmap(
      LAB_ROADMAP,
      LAB_TRACK,
      [reorder(HEAP_FIRST)],
      LAB_CATALOG,
      items,
    )
    expect(summary(effective.weeks)).toEqual([
      { week: 1, topics: ['arrays'], core: ['dsa:a1', 'dsa:a2'] },
      { week: 2, topics: ['two-pointers'], core: ['dsa:t1', 'dsa:t2'] },
      { week: 3, topics: ['heap', 'linked-list'], core: ['dsa:h1', 'dsa:h2', 'dsa:l1'] },
      { week: 4, topics: ['linked-list', 'trees'], core: ['dsa:l2', 'dsa:r1'] },
      { week: 5, topics: ['trees'], core: ['dsa:r2', 'dsa:r3'] },
      { week: 6, topics: ['graphs'], core: ['dsa:g1', 'dsa:g2', 'dsa:g3'] },
    ])
  })

  it('every week keeps its core count; bonus, recap entries and decks stay with their week', () => {
    const effective = effectiveRoadmap(
      LAB_ROADMAP,
      LAB_TRACK,
      [reorder(HEAP_FIRST)],
      LAB_CATALOG,
      items,
    )
    expect(effective.id).toBe(LAB_ROADMAP.id)
    effective.weeks.forEach((week, index) => {
      const base = LAB_ROADMAP.weeks[index]!
      expect(week.week).toBe(base.week)
      expect(week.core).toHaveLength(base.core.length)
      expect(coreItemsOfWeek(week, LAB_CATALOG)).toHaveLength(
        coreItemsOfWeek(base, LAB_CATALOG).length,
      )
      expect(week.bonus).toEqual(base.bonus)
      expect(week.recap).toEqual(base.recap)
      expect(week.decks).toEqual(base.decks)
    })
    const core = effective.weeks.flatMap((week) => week.core)
    expect(core.toSorted()).toEqual(LAB_ROADMAP.weeks.flatMap((week) => week.core).toSorted())
  })

  it('the new-item queue follows it: each topic’s pattern lesson moves with its problems', () => {
    const effective = effectiveRoadmap(
      LAB_ROADMAP,
      LAB_TRACK,
      [reorder(HEAP_FIRST)],
      LAB_CATALOG,
      items,
    )
    const queue = newQueue({
      trackId: 'dsa',
      roadmap: effective,
      catalog: LAB_CATALOG,
      items,
      includeBonus: false,
    })
    expect(queue).toEqual([
      'dsa:lesson-arrays',
      'dsa:a2',
      'dsa:a3',
      'dsa:lesson-two-pointers',
      'dsa:t1',
      'dsa:t2',
      'dsa:lesson-heap',
      'dsa:lesson-linked-list',
      'dsa:h1',
      'dsa:h2',
      'dsa:l1',
      'dsa:lesson-trees',
      'dsa:l2',
      'dsa:r1',
      'dsa:r2',
      'dsa:r3',
      'dsa:lesson-graphs',
      'dsa:g1',
      'dsa:g2',
      'dsa:g3',
      'dsa:c1',
      'dsa:c2',
    ])
  })

  it('the roadmap week stays progress-based (the same sizes)', () => {
    const progressed = labStates(['dsa:a1', 'dsa:a2', 'dsa:t1', 'dsa:t2', 'dsa:h1'])
    const effective = effectiveRoadmap(
      LAB_ROADMAP,
      LAB_TRACK,
      [reorder(HEAP_FIRST)],
      LAB_CATALOG,
      progressed,
    )
    expect(roadmapWeek(effective, LAB_CATALOG, progressed)).toBe(3)
    expect(roadmapWeek(LAB_ROADMAP, LAB_CATALOG, progressed)).toBe(3)
  })

  it('stays put as the learner moves through it (a pure function of the stored order)', () => {
    const later = labStates(['dsa:a1', 'dsa:a2', 'dsa:t1', 'dsa:t2', 'dsa:h1', 'dsa:h2', 'dsa:l1'])
    const before = effectiveRoadmap(
      LAB_ROADMAP,
      LAB_TRACK,
      [reorder(HEAP_FIRST)],
      LAB_CATALOG,
      items,
    )
    const after = effectiveRoadmap(
      LAB_ROADMAP,
      LAB_TRACK,
      [reorder(HEAP_FIRST)],
      LAB_CATALOG,
      later,
    )
    expect(after).toEqual(before)
  })

  it('reorders apply in start order, each on the previous result (application never validates)', () => {
    const second = reorder(['trees', 'linked-list'], 'ro-2', addDays(MONDAY, 3))
    const effective = effectiveRoadmap(
      LAB_ROADMAP,
      LAB_TRACK,
      [second, reorder(HEAP_FIRST)],
      LAB_CATALOG,
      items,
    )
    expect(summary(effective.weeks)).toEqual([
      { week: 1, topics: ['arrays'], core: ['dsa:a1', 'dsa:a2'] },
      { week: 2, topics: ['two-pointers'], core: ['dsa:t1', 'dsa:t2'] },
      { week: 3, topics: ['heap', 'trees'], core: ['dsa:h1', 'dsa:h2', 'dsa:r1'] },
      { week: 4, topics: ['trees'], core: ['dsa:r2', 'dsa:r3'] },
      { week: 5, topics: ['linked-list'], core: ['dsa:l1', 'dsa:l2'] },
      { week: 6, topics: ['graphs'], core: ['dsa:g1', 'dsa:g2', 'dsa:g3'] },
    ])
  })

  it('never modifies its inputs', () => {
    const before = structuredClone(LAB_ROADMAP)
    effectiveRoadmap(LAB_ROADMAP, LAB_TRACK, [reorder(HEAP_FIRST)], LAB_CATALOG, items)
    expect(LAB_ROADMAP).toEqual(before)
  })
})

// ---------------------------------------------------------------------------------------------
// upcomingTopics — decision 35's "started"
// ---------------------------------------------------------------------------------------------

describe('upcomingTopics (decision 35)', () => {
  const upcoming = (ids: readonly string[], overrides: readonly RoadmapOverride[] = []) =>
    upcomingTopics(LAB_TRACK, LAB_ROADMAP, overrides, LAB_CATALOG, labStates(ids))

  it('week 1: every topic but arrays, in roadmap order, then the manifest topics no week lists', () => {
    expect(upcoming([])).toEqual([
      'two-pointers',
      'linked-list',
      'trees',
      'heap',
      'graphs',
      'tries',
    ])
  })

  it('a topic in a week at or before the current week is started (week 3: linked-list and trees)', () => {
    expect(upcoming(['dsa:a1', 'dsa:a2', 'dsa:t1', 'dsa:t2'])).toEqual(['heap', 'graphs', 'tries'])
  })

  it('a topic with one introduced core item counts as started', () => {
    expect(upcoming(['dsa:h1'])).toEqual([
      'two-pointers',
      'linked-list',
      'trees',
      'graphs',
      'tries',
    ])
  })

  it('a bonus or recap item does not start its topic', () => {
    expect(upcoming(['dsa:t3', 'dsa:r4'])).toContain('two-pointers')
    expect(upcoming(['dsa:t3', 'dsa:r4'])).toContain('trees')
  })

  it('follows the effective roadmap', () => {
    expect(upcoming([], [reorder(HEAP_FIRST)])).toEqual(HEAP_FIRST)
  })
})

// ---------------------------------------------------------------------------------------------
// validateOverride — §5.12 / §6.4.5 bounds
// ---------------------------------------------------------------------------------------------

describe('validateOverride (§5.12, §6.4.5)', () => {
  // a3 is a recap introducer, not core: the learner stays in week 1 (only arrays started).
  const weakA3 = itemState('dsa:a3', '2026-09-21', { weak: true, status: 'weak' }, LAB_CATALOG)
  const baseCtx: ValidationContext = {
    catalog: LAB_CATALOG,
    enrollment: labEnrollment(),
    items: { ...labStates(['dsa:a1']), 'dsa:a3': weakA3 },
    today: MONDAY,
    limits: OVERRIDE_LIMITS,
  }
  const codes = (override: RoadmapOverride, change: Partial<ValidationContext> = {}) =>
    validateOverride(override, { ...baseCtx, ...change }).map((issue) => issue.code)

  it('the hard limits are the spec’s (decision 33)', () => {
    expect(OVERRIDE_LIMITS).toEqual({
      insertBlockMaxBudgetShare: 0.25,
      insertBlockMaxDaysAhead: 14,
      extraWeekMaxStudyDays: 5,
    })
  })

  it('issues carry the override’s key', () => {
    expect(validateOverride(insertBlock({ minutes: 16 }), baseCtx)).toEqual([
      { key: 'ib', code: 'over_budget_share' },
    ])
  })

  describe('insert_block', () => {
    it.each([
      ['25 % of the budget exactly (15 of 60)', { minutes: 15 }, []],
      ['one minute over 25 % (16 of 60)', { minutes: 16 }, ['over_budget_share']],
      ['until 14 days ahead', { until: addDays(MONDAY, 14) }, []],
      ['until 15 days ahead', { until: addDays(MONDAY, 15) }, ['until_too_far']],
      ['until today', { until: MONDAY }, []],
      ['until yesterday', { until: addDays(MONDAY, -1) }, ['bad_params']],
      ['an unknown topic', { topicId: 'nope' }, ['unknown_topic']],
      ['a manifest topic no week lists', { topicId: 'tries' }, []],
      ['no weekday', { weekdays: [] }, ['bad_params']],
      ['a weekday twice', { weekdays: ['mon', 'mon'] as const }, ['bad_params']],
      ['zero minutes', { minutes: 0 }, ['bad_params']],
      ['fractional minutes', { minutes: 7.5 }, ['bad_params']],
      ['a malformed until', { until: '2026-13-01' }, ['bad_params']],
    ] as const)('%s → %j', (_, params, expected) => {
      expect(codes(insertBlock(params))).toEqual(expected)
    })

    it('25 % of a 50-minute budget: 12 fits, 13 is over', () => {
      const enrollment = labEnrollment({ budgetMinutes: 50 })
      expect(codes(insertBlock({ minutes: 12 }), { enrollment })).toEqual([])
      expect(codes(insertBlock({ minutes: 13 }), { enrollment })).toEqual(['over_budget_share'])
    })

    it('an unknown param is bad_params', () => {
      const override = insertBlock()
      const withExtra = {
        ...override,
        params: { ...override.params, extra: 1 },
      } as unknown as RoadmapOverride
      expect(codes(withExtra)).toEqual(['bad_params'])
    })

    it('another track than the enrollment’s is bad_params', () => {
      expect(codes({ ...insertBlock(), trackId: 'english' })).toEqual(['bad_params'])
    })
  })

  describe('extra_week', () => {
    it.each([
      ['5 study days, the topic has a Weak item', extraWeek('arrays', 5), []],
      ['6 study days', extraWeek('arrays', 6), ['too_many_days']],
      ['no Weak item in the topic', extraWeek('two-pointers', 3), ['no_weak_item']],
      ['an unknown topic', extraWeek('nope', 3), ['unknown_topic']],
      ['0 study days', extraWeek('arrays', 0), ['bad_params']],
    ] as const)('%s → %j', (_, override, expected) => {
      expect(codes(override)).toEqual(expected)
    })

    it('a Weak item of a retired catalog item does not count', () => {
      const catalog = {
        ...LAB_CATALOG,
        items: {
          ...LAB_CATALOG.items,
          'dsa:a3': { ...LAB_CATALOG.items['dsa:a3']!, status: 'retired' as const },
        },
      }
      expect(codes(extraWeek('arrays'), { catalog })).toEqual(['no_weak_item'])
    })

    it('a Weak custom item of the topic counts', () => {
      const custom = customCard('two-pointers-card', 'two-pointers')
      const catalog = labCatalogWith(custom)
      const weak = itemState(custom.id, '2026-09-21', { weak: true, status: 'weak' }, catalog)
      expect(
        codes(extraWeek('two-pointers'), {
          catalog,
          items: { ...baseCtx.items, [custom.id]: weak },
        }),
      ).toEqual([])
    })
  })

  describe('reorder_topics', () => {
    it.each([
      ['every upcoming topic, requires kept', HEAP_FIRST, []],
      [
        'the roadmap order itself',
        ['two-pointers', 'linked-list', 'trees', 'heap', 'graphs', 'tries'],
        [],
      ],
      ['moves a started topic', ['arrays', ...HEAP_FIRST], ['not_upcoming']],
      ['drops a topic', HEAP_FIRST.filter((topic) => topic !== 'tries'), ['not_permutation']],
      ['adds an unknown topic', [...HEAP_FIRST, 'nope'], ['unknown_topic']],
      ['names a topic twice', [...HEAP_FIRST, 'heap'], ['not_permutation']],
      [
        'trees before linked-list (trees requires it)',
        ['two-pointers', 'trees', 'linked-list', 'heap', 'graphs', 'tries'],
        ['breaks_requires'],
      ],
      [
        'linked-list before two-pointers (not started yet)',
        ['linked-list', 'two-pointers', 'trees', 'heap', 'graphs', 'tries'],
        ['breaks_requires'],
      ],
      ['an empty order', [], ['bad_params']],
    ] as const)('%s → %j', (_, order, expected) => {
      expect(codes(reorder(order))).toEqual(expected)
    })

    it('requires are met by started topics (week 3: trees started, graphs may go first)', () => {
      const items = labStates(['dsa:a1', 'dsa:a2', 'dsa:t1', 'dsa:t2'])
      expect(codes(reorder(['graphs', 'tries', 'heap']), { items })).toEqual([])
      expect(codes(reorder(['trees', 'heap', 'graphs', 'tries']), { items })).toEqual([
        'not_upcoming',
      ])
    })

    it('a topic with one introduced core item is started: it may not move', () => {
      const items = labStates(['dsa:h1'])
      const withoutHeap = HEAP_FIRST.filter((topic) => topic !== 'heap')
      expect(codes(reorder(withoutHeap), { items })).toEqual([])
      expect(codes(reorder(HEAP_FIRST), { items })).toEqual(['not_upcoming'])
    })

    it('a roadmap whose core items all live in decks (English) cannot be reordered (6.6c)', () => {
      const deckOnly = {
        ...LAB_ROADMAP,
        weeks: LAB_ROADMAP.weeks.map((week) => ({ ...week, core: [] })),
      }
      const catalog = {
        ...LAB_CATALOG,
        tracks: { dsa: { ...LAB_TRACK, roadmaps: { '6w': deckOnly } } },
      }
      expect(reorderable(deckOnly)).toBe(false)
      expect(reorderable(LAB_ROADMAP)).toBe(true)
      expect(codes(reorder(HEAP_FIRST), { catalog })).toEqual(['not_reorderable'])
    })

    it('checks against the other active overrides’ effective roadmap; a same key is replaced', () => {
      const active = reorder(HEAP_FIRST, 'ro-old')
      const next = ['two-pointers', 'linked-list', 'heap', 'trees', 'graphs', 'tries']
      expect(codes(reorder(next), { overrides: [active] })).toEqual([])
      expect(codes(reorder(next, 'ro-old'), { overrides: [active] })).toEqual([])
    })
  })
})
