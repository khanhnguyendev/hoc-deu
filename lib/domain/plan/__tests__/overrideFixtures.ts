/**
 * A six-week DSA-like track for the roadmap-override tests (platform design §5.12; Part B-M6
 * decision 35; task 6.6b): topics with `requires`, a week that mixes two topics (W3), a topic that
 * spans two weeks (trees, W3–W4), a manifest topic no week lists (tries), bonus problems, recap
 * entries (one that introduces its item) and a deck with a core and an extended card. Tests copy
 * and change it; they never mutate it.
 */
import type { PlanCatalog, PlanItem, PlanRoadmap, PlanTopic, PlanTrack } from '../../catalog'
import type { ItemState } from '../../state'
import type { LocalDay } from '../../time/localDay'
import type { Enrollment } from '../types'
import { DSA_CARD_SRS, DSA_SRS, DSA_TEMPLATE, flat, itemState, planItem } from './fixtures'

/** Manifest order. trees requires linked-list; heap only arrays (so it may move before trees). */
export const LAB_TOPICS: readonly PlanTopic[] = [
  { id: 'arrays', requires: [] },
  { id: 'two-pointers', requires: ['arrays'] },
  { id: 'linked-list', requires: ['two-pointers'] },
  { id: 'trees', requires: ['linked-list'] },
  { id: 'heap', requires: ['arrays'] },
  { id: 'graphs', requires: ['trees'] },
  { id: 'tries', requires: ['trees'] },
]

export const LAB_ROADMAP: PlanRoadmap = {
  id: '6w',
  weeks: [
    {
      week: 1,
      topics: ['arrays'],
      core: ['dsa:a1', 'dsa:a2'],
      bonus: [],
      recap: [{ item: 'dsa:a3' }],
      decks: [],
    },
    {
      week: 2,
      topics: ['two-pointers'],
      core: ['dsa:t1', 'dsa:t2'],
      bonus: ['dsa:t3'],
      recap: [{ item: 'dsa:a1', mode: 'redo' }],
      decks: [],
    },
    {
      week: 3,
      topics: ['linked-list', 'trees'],
      core: ['dsa:l1', 'dsa:l2', 'dsa:r1'],
      bonus: [],
      recap: [],
      decks: [],
    },
    {
      week: 4,
      topics: ['trees'],
      core: ['dsa:r2', 'dsa:r3'],
      bonus: ['dsa:r4'],
      recap: [{ item: 'dsa:l1', mode: 'recall' }],
      decks: [],
    },
    { week: 5, topics: ['heap'], core: ['dsa:h1', 'dsa:h2'], bonus: [], recap: [], decks: [] },
    {
      week: 6,
      topics: ['graphs'],
      core: ['dsa:g1', 'dsa:g2', 'dsa:g3'],
      bonus: [],
      recap: [],
      decks: ['dsa:deck-graphs'],
    },
  ],
}

export const LAB_TRACK: PlanTrack = {
  id: 'dsa',
  status: 'active',
  weeklyTemplate: DSA_TEMPLATE,
  defaults: { budgetMinutes: 60, newPerDay: null, throttle: [] },
  roadmaps: { '6w': LAB_ROADMAP },
  topics: LAB_TOPICS,
}

/** An Easy problem: new 20, recall / review / explain-aloud 5, redo 12. */
const problem = (id: string, topicId: string): PlanItem =>
  planItem({
    id,
    trackId: 'dsa',
    itemType: 'problem',
    topicId,
    difficulty: 'E',
    srs: DSA_SRS,
    minutes: { new: 20, review: 5, recall: 5, redo: 12, 'explain-aloud': 5 },
    reviewModes: true,
  })

const lesson = (topicId: string): PlanItem =>
  planItem({
    id: `dsa:lesson-${topicId}`,
    trackId: 'dsa',
    itemType: 'lesson',
    topicId,
    minutes: flat(25),
  })

const card = (id: string, tier: 'core' | 'extended'): PlanItem =>
  planItem({
    id,
    trackId: 'dsa',
    itemType: 'flashcard',
    topicId: 'graphs',
    week: 6,
    srs: DSA_CARD_SRS,
    minutes: { new: 1.5, review: 0.5, recall: 0.5, redo: 0.5, 'explain-aloud': 0.5 },
    tier,
    deckId: 'dsa:deck-graphs',
  })

/** A learner's custom flashcard (`user:<bot_ref>:<slug>`, decision 17) of `topicId`. */
export const customCard = (slug: string, topicId: string): PlanItem =>
  planItem({
    id: `user:u1:${slug}`,
    trackId: 'dsa',
    itemType: 'flashcard',
    topicId,
    srs: DSA_CARD_SRS,
    minutes: { new: 1.5, review: 0.5, recall: 0.5, redo: 0.5, 'explain-aloud': 0.5 },
    tier: 'extended',
  })

const LAB_ITEMS: readonly PlanItem[] = [
  ...['arrays', 'two-pointers', 'linked-list', 'trees', 'heap', 'graphs'].map(lesson),
  problem('dsa:a1', 'arrays'),
  problem('dsa:a2', 'arrays'),
  problem('dsa:a3', 'arrays'),
  problem('dsa:t1', 'two-pointers'),
  problem('dsa:t2', 'two-pointers'),
  problem('dsa:t3', 'two-pointers'),
  problem('dsa:l1', 'linked-list'),
  problem('dsa:l2', 'linked-list'),
  problem('dsa:r1', 'trees'),
  problem('dsa:r2', 'trees'),
  problem('dsa:r3', 'trees'),
  problem('dsa:r4', 'trees'),
  problem('dsa:h1', 'heap'),
  problem('dsa:h2', 'heap'),
  problem('dsa:g1', 'graphs'),
  problem('dsa:g2', 'graphs'),
  problem('dsa:g3', 'graphs'),
  card('dsa:c1', 'core'),
  card('dsa:c2', 'extended'),
]

export const LAB_CATALOG: PlanCatalog = {
  tracks: { dsa: LAB_TRACK },
  items: Object.fromEntries(LAB_ITEMS.map((item) => [item.id, item])),
  decks: {
    'dsa:deck-graphs': {
      id: 'dsa:deck-graphs',
      trackId: 'dsa',
      status: 'active',
      cardIds: ['dsa:c1', 'dsa:c2'],
    },
  },
}

/** `LAB_CATALOG` plus `items` (custom items, typically). */
export function labCatalogWith(...items: readonly PlanItem[]): PlanCatalog {
  return {
    ...LAB_CATALOG,
    items: { ...LAB_CATALOG.items, ...Object.fromEntries(items.map((item) => [item.id, item])) },
  }
}

/** The lab track's enrollment (6w, 60 min, the DSA template), starting 2026-09-28. */
export function labEnrollment(change: Partial<Enrollment> = {}): Enrollment {
  return {
    trackId: 'dsa',
    variant: '6w',
    status: 'active',
    startDate: '2026-09-28',
    budgetMinutes: 60,
    newPerDay: null,
    throttle: [],
    weeklyTemplate: DSA_TEMPLATE,
    includeBonus: false,
    resetOn: null,
    ...change,
  }
}

/** Item states for `ids`, each a level-1 success on `day` (`itemState` on `catalog`). */
export function labStates(
  ids: readonly string[],
  day: LocalDay = '2026-09-21',
  catalog: PlanCatalog = LAB_CATALOG,
  state: Partial<ItemState> = {},
): Record<string, ItemState> {
  return Object.fromEntries(ids.map((id) => [id, itemState(id, day, state, catalog)]))
}
