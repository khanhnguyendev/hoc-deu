/**
 * The English simulation's fixed synthetic content (platform design §5.10; Part B-M4 decision 20):
 * the §5.10 card counts per week rather than the real decks, so English content PRs — the v1.1
 * bot's — never make the simulation stale. Ten weeks, one deck each: core cards
 * `[12, 16, 14, 14, 12, 13, 16, 14, 11, 13]` (135), extended cards `30 − core` for weeks 1–3, six
 * exercises and one weekend prompt per week; 105 "Explaining code" cards derived from problems
 * outside the track, whose sources gain a result at 0.9 a day (`externalResults`). The track runs
 * the real English template, 25 minutes a day, `newPerDay` 8, throttle > 40 → 4, > 60 → 0.
 */
import type {
  ItemMode,
  PlanCatalog,
  PlanDeck,
  PlanItem,
  PlanRoadmapWeek,
  PlanTrack,
  PlanWeeklyTemplate,
  SrsParams,
} from '../../catalog'
import type { SimOptions } from '../simulate'
import type { Enrollment } from '../types'
import { planItem } from './fixtures'

export const ENGLISH_CORE_PER_WEEK = [12, 16, 14, 14, 12, 13, 16, 14, 11, 13] as const
/** Weeks 1–3 have `30 − core` extended cards (§5.10). */
const CARDS_PER_EXTENDED_WEEK = 30
const EXTENDED_WEEKS = 3
const EXERCISES_PER_WEEK = 6
export const ENGLISH_DERIVED_CARDS = 105
export const ENGLISH_DERIVED_PER_DAY = 0.9

/** `content/tracks/english/track.yaml` `weeklyTemplate`; `tools/sim/projections.test.ts` keeps
 *  the two equal. */
export const ENGLISH_MODEL_TEMPLATE: PlanWeeklyTemplate = {
  'mon-fri': [
    { kind: 'practice', itemType: 'exercise', minutes: 5 },
    { kind: 'practice', tag: 'shadowing', minutes: 3 },
    { kind: 'review' },
    { kind: 'new' },
  ],
  sat: [{ kind: 'review' }],
  sun: [{ kind: 'practice', tag: 'weekend-task', minutes: 15 }, { kind: 'review' }],
}

const ENGLISH_SRS: SrsParams = { intervals: [1, 3, 7, 14], relearnDays: 1, masteredAfter: 2 }
const SOURCE_SRS: SrsParams = { intervals: [7, 21, 60], relearnDays: 3, masteredAfter: 2 }

const CARD_MINUTES: Record<ItemMode, number> = {
  new: 1.5,
  review: 0.5,
  recall: 0.5,
  redo: 0.5,
  'explain-aloud': 0.5,
}
const flat = (minutes: number): Record<ItemMode, number> => ({
  new: minutes,
  review: minutes,
  recall: minutes,
  redo: minutes,
  'explain-aloud': minutes,
})

const pad = (n: number, width = 2): string => String(n).padStart(width, '0')
const weekKey = (week: number): string => `w${pad(week)}`
const deckId = (week: number): string => `english:deck-${weekKey(week)}`
const topicId = (week: number): string => `topic-${weekKey(week)}`

function card(week: number, tier: 'core' | 'extended', n: number): PlanItem {
  return planItem({
    id: `english:${weekKey(week)}-${tier}-${pad(n)}`,
    trackId: 'english',
    itemType: 'flashcard',
    topicId: topicId(week),
    week,
    srs: ENGLISH_SRS,
    minutes: CARD_MINUTES,
    tier,
    deckId: deckId(week),
    hasExample: true,
  })
}

const range = (count: number): number[] => Array.from({ length: count }, (_, index) => index + 1)

const weeks = ENGLISH_CORE_PER_WEEK.map((core, index) => {
  const week = index + 1
  const extended = week <= EXTENDED_WEEKS ? CARDS_PER_EXTENDED_WEEK - core : 0
  const cards = [
    ...range(core).map((n) => card(week, 'core', n)),
    ...range(extended).map((n) => card(week, 'extended', n)),
  ]
  const exercises = range(EXERCISES_PER_WEEK).map((n) =>
    planItem({
      id: `english:${weekKey(week)}-exercise-${n}`,
      trackId: 'english',
      itemType: 'exercise',
      topicId: topicId(week),
      week,
      minutes: flat(5),
    }),
  )
  const prompt = planItem({
    id: `english:${weekKey(week)}-weekend-task`,
    trackId: 'english',
    itemType: 'prompt',
    week,
    tag: 'weekend-task',
    minutes: flat(10),
  })
  const deck: PlanDeck = {
    id: deckId(week),
    trackId: 'english',
    status: 'active',
    cardIds: cards.map((item) => item.id),
  }
  const roadmapWeek: PlanRoadmapWeek = {
    week,
    topics: [topicId(week)],
    core: [],
    bonus: [],
    recap: [],
    decks: [deck.id],
  }
  return { items: [...cards, ...exercises, prompt], deck, roadmapWeek }
})

/** The derived cards' sources: problems of another track, in the order they gain a result. */
export const ENGLISH_DERIVED_SOURCES: readonly string[] = range(ENGLISH_DERIVED_CARDS).map(
  (n) => `dsa:model-source-${pad(n, 3)}`,
)

const sources = ENGLISH_DERIVED_SOURCES.map((id) =>
  planItem({
    id,
    trackId: 'dsa',
    itemType: 'problem',
    topicId: 'arrays-hashing',
    srs: SOURCE_SRS,
    minutes: { new: 35, review: 5, recall: 5, redo: 21, 'explain-aloud': 5 },
    reviewModes: true,
    difficulty: 'M',
  }),
)

const derivedCards = ENGLISH_DERIVED_SOURCES.map((source) =>
  planItem({
    id: `english:explaining-code:${source}`,
    trackId: 'english',
    itemType: 'flashcard',
    srs: ENGLISH_SRS,
    minutes: CARD_MINUTES,
    tier: 'derived',
    derivedFrom: source,
  }),
)

const ENGLISH_MODEL_TRACK: PlanTrack = {
  id: 'english',
  status: 'active',
  weeklyTemplate: ENGLISH_MODEL_TEMPLATE,
  defaults: {
    budgetMinutes: 25,
    newPerDay: 8,
    throttle: [
      { dueAbove: 40, newPerDay: 4 },
      { dueAbove: 60, newPerDay: 0 },
    ],
  },
  roadmaps: { '10w': { id: '10w', weeks: weeks.map((week) => week.roadmapWeek) } },
}

const byId = <T extends { readonly id: string }>(entries: readonly T[]): Record<string, T> =>
  Object.fromEntries(entries.map((entry) => [entry.id, entry]))

export const ENGLISH_MODEL_CATALOG: PlanCatalog = {
  tracks: { english: ENGLISH_MODEL_TRACK },
  items: byId([...weeks.flatMap((week) => week.items), ...derivedCards, ...sources]),
  decks: byId(weeks.map((week) => week.deck)),
}

export function englishModelEnrollment(startDate: string): Enrollment {
  const { defaults } = ENGLISH_MODEL_TRACK
  return {
    trackId: 'english',
    variant: '10w',
    status: 'active',
    startDate,
    budgetMinutes: defaults.budgetMinutes,
    newPerDay: defaults.newPerDay,
    throttle: defaults.throttle,
    weeklyTemplate: ENGLISH_MODEL_TEMPLATE,
    includeBonus: false,
    resetOn: null,
  }
}

/** The derived cards' sources gain a result at 0.9 a day (§5.10). */
export const ENGLISH_EXTERNAL_RESULTS: NonNullable<SimOptions['externalResults']> = {
  itemIds: ENGLISH_DERIVED_SOURCES,
  perDay: ENGLISH_DERIVED_PER_DAY,
}
