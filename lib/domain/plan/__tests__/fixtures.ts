/**
 * Hand-built catalogs and state for the plan-engine tests (Part B-M4, task 4.0). Small on
 * purpose: two DSA weeks and two English weeks with every case the engine branches on — a pattern
 * and a deep-dive lesson, a recap entry that introduces its item, a bonus and a retired core
 * problem, a repeatable prompt, core / extended / derived cards, cards with and without an
 * example, weekly exercises and prompts. Tests copy and change them; they never mutate them.
 */
import type {
  ItemMode,
  PlanCatalog,
  PlanItem,
  PlanRoadmap,
  PlanTrack,
  PlanWeeklyTemplate,
  SrsParams,
} from '../../catalog'
import type { ItemState } from '../../state'
import type { LocalDay } from '../../time/localDay'
import type { Enrollment, PlanContext } from '../types'

export const DSA_SRS: SrsParams = { intervals: [7, 21, 60], relearnDays: 3, masteredAfter: 2 }
export const DSA_CARD_SRS: SrsParams = {
  intervals: [1, 3, 7, 14],
  relearnDays: 1,
  masteredAfter: 2,
}
export const ENGLISH_SRS: SrsParams = { intervals: [1, 3, 7, 14], relearnDays: 1, masteredAfter: 2 }

/** Every mode costs `minutes`. */
export const flat = (minutes: number): Record<ItemMode, number> => ({
  new: minutes,
  review: minutes,
  recall: minutes,
  redo: minutes,
  'explain-aloud': minutes,
})

/** DSA problem minutes (§5.4): new E/M/H 20/35/50, recall and explain-aloud 5, redo ×0.6. */
const PROBLEM_MINUTES = {
  E: { new: 20, review: 5, recall: 5, redo: 12, 'explain-aloud': 5 },
  M: { new: 35, review: 5, recall: 5, redo: 21, 'explain-aloud': 5 },
  H: { new: 50, review: 5, recall: 5, redo: 30, 'explain-aloud': 5 },
} as const satisfies Record<string, Record<ItemMode, number>>

const CARD_MINUTES: Record<ItemMode, number> = {
  new: 1.5,
  review: 0.5,
  recall: 0.5,
  redo: 0.5,
  'explain-aloud': 0.5,
}

/** A plan item with neutral defaults; pass what the test is about. */
export function planItem(
  item: Partial<PlanItem> & Pick<PlanItem, 'id' | 'trackId' | 'itemType'>,
): PlanItem {
  return {
    topicId: null,
    week: null,
    status: 'active',
    srs: null,
    minutes: flat(10),
    reviewModes: false,
    difficulty: null,
    tier: null,
    deckId: null,
    derivedFrom: null,
    about: null,
    deepDiveId: null,
    tag: null,
    repeatable: false,
    hasExample: false,
    ...item,
  }
}

const problem = (
  id: string,
  difficulty: 'E' | 'M' | 'H',
  topicId: string,
  extra: Partial<PlanItem> = {},
): PlanItem =>
  planItem({
    id,
    trackId: 'dsa',
    itemType: 'problem',
    topicId,
    difficulty,
    srs: DSA_SRS,
    minutes: PROBLEM_MINUTES[difficulty],
    reviewModes: true,
    ...extra,
  })

const lesson = (id: string, topicId: string, about: string | null = null): PlanItem =>
  planItem({ id, trackId: 'dsa', itemType: 'lesson', topicId, about, minutes: flat(25) })

const card = (
  id: string,
  deckId: string,
  week: number,
  tier: 'core' | 'extended',
  hasExample: boolean,
): PlanItem =>
  planItem({
    id,
    trackId: 'english',
    itemType: 'flashcard',
    topicId: week === 1 ? 'standup' : 'tickets',
    week,
    srs: ENGLISH_SRS,
    minutes: CARD_MINUTES,
    tier,
    deckId,
    hasExample,
  })

const derivedCard = (source: string): PlanItem =>
  planItem({
    id: `english:explaining-code:${source}`,
    trackId: 'english',
    itemType: 'flashcard',
    srs: ENGLISH_SRS,
    minutes: CARD_MINUTES,
    tier: 'derived',
    derivedFrom: source,
  })

const exercise = (id: string, week: number): PlanItem =>
  planItem({ id, trackId: 'english', itemType: 'exercise', week, minutes: flat(5) })

const weeklyPrompt = (id: string, week: number): PlanItem =>
  planItem({
    id,
    trackId: 'english',
    itemType: 'prompt',
    week,
    tag: 'weekend-task',
    minutes: flat(10),
  })

export const DSA_TEMPLATE: PlanWeeklyTemplate = {
  'mon-fri': [{ kind: 'review', maxMinutes: 15 }, { kind: 'new' }],
  sat: [{ kind: 'review' }],
  sun: [
    { kind: 'practice', tag: 'mock-interview', minutes: 45, fromWeek: 3 },
    { kind: 'recap', count: 3 },
  ],
}

export const ENGLISH_TEMPLATE: PlanWeeklyTemplate = {
  'mon-fri': [
    { kind: 'practice', itemType: 'exercise', minutes: 5 },
    { kind: 'practice', tag: 'shadowing', minutes: 3 },
    { kind: 'review' },
    { kind: 'new' },
  ],
  sat: [{ kind: 'review' }],
  sun: [{ kind: 'practice', tag: 'weekend-task', minutes: 15 }, { kind: 'review' }],
}

/** Two DSA weeks. W1 recap introduces p4; W2 lists a retired core problem (p8) and a bonus (p7). */
export const DSA_8W: PlanRoadmap = {
  id: '8w',
  weeks: [
    {
      week: 1,
      topics: ['arrays'],
      core: ['dsa:p1', 'dsa:p2', 'dsa:p3'],
      bonus: [],
      recap: [
        { item: 'dsa:p4' },
        { item: 'dsa:p2', mode: 'redo' },
        { item: 'dsa:p1', mode: 'explain-aloud' },
      ],
      decks: [],
    },
    {
      week: 2,
      topics: ['two-pointers'],
      core: ['dsa:p5', 'dsa:p6', 'dsa:p8'],
      bonus: ['dsa:p7'],
      recap: [{ item: 'dsa:p3', mode: 'redo' }],
      decks: [],
    },
  ],
}

export const DSA_TRACK: PlanTrack = {
  id: 'dsa',
  status: 'active',
  weeklyTemplate: DSA_TEMPLATE,
  defaults: { budgetMinutes: 60, newPerDay: null, throttle: [] },
  roadmaps: { '8w': DSA_8W },
}

export const ENGLISH_10W: PlanRoadmap = {
  id: '10w',
  weeks: [
    { week: 1, topics: ['standup'], core: [], bonus: [], recap: [], decks: ['english:deck-w1'] },
    { week: 2, topics: ['tickets'], core: [], bonus: [], recap: [], decks: ['english:deck-w2'] },
  ],
}

export const ENGLISH_TRACK: PlanTrack = {
  id: 'english',
  status: 'active',
  weeklyTemplate: ENGLISH_TEMPLATE,
  defaults: {
    budgetMinutes: 25,
    newPerDay: 8,
    throttle: [
      { dueAbove: 40, newPerDay: 4 },
      { dueAbove: 60, newPerDay: 0 },
    ],
  },
  roadmaps: { '10w': ENGLISH_10W },
}

const byId = (items: readonly PlanItem[]): Record<string, PlanItem> =>
  Object.fromEntries(items.map((item) => [item.id, item]))

export const DSA_ITEMS: readonly PlanItem[] = [
  lesson('dsa:lesson-arrays', 'arrays'),
  lesson('dsa:lesson-two-pointers', 'two-pointers'),
  lesson('dsa:lesson-deep-dive-p3', 'arrays', 'dsa:p3'),
  problem('dsa:p1', 'E', 'arrays'),
  problem('dsa:p2', 'M', 'arrays'),
  problem('dsa:p3', 'M', 'arrays', { deepDiveId: 'dsa:lesson-deep-dive-p3' }),
  problem('dsa:p4', 'H', 'arrays'),
  problem('dsa:p5', 'E', 'two-pointers'),
  problem('dsa:p6', 'M', 'two-pointers'),
  problem('dsa:p7', 'M', 'two-pointers'),
  problem('dsa:p8', 'M', 'two-pointers', { status: 'retired' }),
  planItem({
    id: 'dsa:prompt-mock',
    trackId: 'dsa',
    itemType: 'prompt',
    tag: 'mock-interview',
    repeatable: true,
    minutes: flat(45),
  }),
]

export const ENGLISH_ITEMS: readonly PlanItem[] = [
  card('english:e1', 'english:deck-w1', 1, 'core', true),
  card('english:e2', 'english:deck-w1', 1, 'core', true),
  card('english:e3', 'english:deck-w1', 1, 'core', false),
  card('english:e4', 'english:deck-w1', 1, 'core', false),
  card('english:x1', 'english:deck-w1', 1, 'extended', true),
  card('english:x2', 'english:deck-w1', 1, 'extended', false),
  card('english:e5', 'english:deck-w2', 2, 'core', true),
  card('english:e6', 'english:deck-w2', 2, 'core', false),
  derivedCard('dsa:p1'),
  derivedCard('dsa:p2'),
  exercise('english:ex-w1-a', 1),
  exercise('english:ex-w1-b', 1),
  exercise('english:ex-w2-a', 2),
  weeklyPrompt('english:prompt-w1', 1),
  weeklyPrompt('english:prompt-w2', 2),
]

/** DSA and English together: derived English cards unlock from DSA problems. */
export const CATALOG: PlanCatalog = {
  tracks: { dsa: DSA_TRACK, english: ENGLISH_TRACK },
  items: byId([...DSA_ITEMS, ...ENGLISH_ITEMS]),
  decks: {
    'english:deck-w1': {
      id: 'english:deck-w1',
      trackId: 'english',
      status: 'active',
      cardIds: ['english:e1', 'english:e2', 'english:e3', 'english:e4', 'english:x1', 'english:x2'],
    },
    'english:deck-w2': {
      id: 'english:deck-w2',
      trackId: 'english',
      status: 'active',
      cardIds: ['english:e5', 'english:e6'],
    },
  },
}

export const EMPTY_CATALOG: PlanCatalog = { tracks: {}, items: {}, decks: {} }

/** A copy of `catalog` with `changes` applied to the named items. */
export function withItems(
  catalog: PlanCatalog,
  changes: Readonly<Record<string, Partial<PlanItem>>>,
): PlanCatalog {
  const items = { ...catalog.items }
  for (const [id, change] of Object.entries(changes)) {
    const item = items[id]
    if (item === undefined) throw new Error(`withItems: no item ${id}`)
    items[id] = { ...item, ...change }
  }
  return { ...catalog, items }
}

/**
 * An item's state as a fresh success at level 1 would leave it, introduced on `day`; pass the
 * fields the test is about. `trackId`, `topicId` and `itemType` come from `CATALOG`.
 */
export function itemState(
  itemId: string,
  day: LocalDay,
  state: Partial<ItemState> = {},
  catalog: PlanCatalog = CATALOG,
): ItemState {
  const item = catalog.items[itemId]
  if (item === undefined) throw new Error(`itemState: no item ${itemId}`)
  return {
    itemId,
    trackId: item.trackId,
    topicId: item.topicId,
    itemType: item.itemType,
    level: item.srs === null ? 0 : 1,
    weak: false,
    topSuccesses: 0,
    status: 'ok',
    dueOn: null,
    lastResult: item.srs === null ? 'completed' : 'solved',
    lastResultOn: day,
    introducedOn: day,
    lapses: 0,
    reps: 1,
    ...state,
  }
}

/** Item states by ID. */
export const statesOf = (...states: readonly ItemState[]): Record<string, ItemState> =>
  Object.fromEntries(states.map((state) => [state.itemId, state]))

/** An active enrollment with the track's defaults (DSA 8w, English 10w), starting 2026-09-28. */
export function enrollment(
  trackId: 'dsa' | 'english',
  change: Partial<Enrollment> = {},
): Enrollment {
  const track = CATALOG.tracks[trackId]
  if (track === undefined) throw new Error(`enrollment: no track ${trackId}`)
  return {
    trackId,
    variant: trackId === 'dsa' ? '8w' : '10w',
    status: 'active',
    startDate: '2026-09-28',
    budgetMinutes: track.defaults.budgetMinutes,
    newPerDay: track.defaults.newPerDay,
    throttle: track.defaults.throttle,
    weeklyTemplate: track.weeklyTemplate,
    includeBonus: false,
    resetOn: null,
    ...change,
  }
}

/** 2026-09-28 is a Monday; 2026-10-03 a Saturday; 2026-10-04 a Sunday. */
export const MONDAY = '2026-09-28'
export const SATURDAY = '2026-10-03'
export const SUNDAY = '2026-10-04'

/** A plan context on `MONDAY` with both tracks enrolled and nothing studied yet. */
export function planContext(change: Partial<PlanContext> = {}): PlanContext {
  return {
    planDate: MONDAY,
    catalog: CATALOG,
    enrollments: [enrollment('dsa'), enrollment('english')],
    items: {},
    recapDone: {},
    ...change,
  }
}
