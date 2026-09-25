/**
 * A fixture catalog for the roadmap view model and loaders (task 3.4b): a DSA-like track with an
 * 8w roadmap (its 10w file missing, decision 4), an English-like track with a 10w roadmap, decks,
 * exercises, prompts and a derived deck, plus a draft and a retired track. Drafts and retired
 * items are mixed in on purpose. Test-only: never imported by app code or `index.ts`.
 */
import {
  cardItem,
  derivedCardItem,
  fillBlankItem,
  lessonItem,
  problemItem,
  promptItem,
  weeklyPromptItem,
} from '@/features/items/fixtures'
import { createCatalogAccess, type CatalogAccess } from '@/lib/content/catalog-access'
import type { Catalog, CatalogItem, DeckSummary } from '@/lib/content/catalog-types'
import type { ItemStatus } from '@/lib/content/schemas/common'
import type { TrackManifest } from '@/lib/content/schemas/manifest'
import type { Roadmap } from '@/lib/content/schemas/roadmap'

const SRS = { intervals: [7, 21, 60], relearnDays: 3, masteredAfter: 2 }

const topic = (id: string, title: string) => ({
  id,
  title: { vi: title, en: title },
  signals: [],
  requires: [],
})

export const DSA_TRACK: TrackManifest = {
  id: 'dsa',
  status: 'active',
  title: { vi: 'Cấu trúc dữ liệu & Giải thuật', en: 'Data Structures & Algorithms' },
  accent: 'track-1',
  itemTypes: ['lesson', 'problem', 'prompt', 'flashcard'],
  codeLanguages: ['python', 'java', 'go'],
  srs: SRS,
  review: { recallMinutes: 5, redoFactor: 0.6 },
  topics: [
    topic('arrays-hashing', 'Arrays & Hashing'),
    topic('two-pointers', 'Two Pointers'),
    topic('sliding-window', 'Sliding Window'),
    topic('stack', 'Stack'),
  ],
  lessonFormats: {
    pattern: { sections: ['signals', 'approach'], requires: ['anchor', 'practice'], rules: [] },
    'deep-dive': { sections: ['approach'], requires: ['about', 'practice'], rules: [] },
  },
  defaults: { budgetMinutes: 60, newPerDay: null, throttle: [] },
  estimates: { lesson: 25, problem: { new: { E: 20, M: 35, H: 50 } }, prompt: 10 },
  decks: [],
  roadmaps: [{ id: '8w', recommendedBelowMinutes: 75 }, { id: '10w' }],
  weeklyTemplate: {
    'mon-fri': [{ kind: 'review', maxMinutes: 15 }, { kind: 'new' }],
    sat: [{ kind: 'review' }],
  },
}

export const ENGLISH_TRACK: TrackManifest = {
  id: 'english',
  status: 'active',
  title: { vi: 'Tiếng Anh cho môi trường IT', en: 'English for IT workplaces' },
  accent: 'track-2',
  itemTypes: ['flashcard', 'exercise', 'prompt'],
  srs: { intervals: [1, 3, 7, 14], relearnDays: 1, masteredAfter: 2 },
  topics: [topic('standup', 'Họp stand-up')],
  defaults: {
    budgetMinutes: 25,
    newPerDay: 8,
    throttle: [{ dueAbove: 40, newPerDay: 4 }],
  },
  estimates: { flashcard: { new: 1.5, review: 0.5 }, exercise: 5, prompt: 10 },
  decks: [
    {
      id: 'explaining-code',
      kind: 'derived',
      title: { vi: 'Giải thích code', en: 'Explaining code' },
      from: { track: 'dsa', itemType: 'problem' },
      unlock: 'attempted',
      map: { front: { template: 'Explain {problem.title}.' }, back: 'note.bilingual.en' },
    },
  ],
  roadmaps: [{ id: '10w' }],
  weeklyTemplate: { sun: [{ kind: 'practice', tag: 'weekend-task', minutes: 15 }] },
}

/** Only admins see it (§3.3). */
export const DRAFT_TRACK: TrackManifest = {
  ...ENGLISH_TRACK,
  id: 'sysdesign',
  status: 'draft',
  title: { vi: 'Thiết kế hệ thống', en: 'System design' },
  accent: 'track-3',
  decks: [],
  roadmaps: [{ id: '6w' }],
}

/** No new learners; enrolled learners keep it. */
export const RETIRED_TRACK: TrackManifest = {
  ...ENGLISH_TRACK,
  id: 'legacy',
  status: 'retired',
  title: { vi: 'Lộ trình cũ', en: 'Legacy track' },
  accent: 'track-4',
  decks: [],
  roadmaps: [{ id: '4w' }],
}

// ---------------------------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------------------------

/** A DSA problem `dsa:lc-<nnnn>` in `topic`, with `status`. */
function problem(
  leetcode: number,
  title: string,
  topicId: string,
  status: ItemStatus = 'active',
): CatalogItem<'problem'> {
  const localId = `lc-${String(leetcode).padStart(4, '0')}`
  const id = `dsa:${localId}`
  return problemItem({
    id,
    localId,
    title,
    topicId,
    status,
    content: { id, leetcode, title, topic: topicId, status, difficulty: 'E', note: null },
  })
}

function lesson(
  slug: string,
  title: string,
  topicId: string,
  format: string,
  status: ItemStatus = 'active',
): CatalogItem<'lesson'> {
  const id = `dsa:lesson-${slug}`
  return lessonItem({
    id,
    localId: `lesson-${slug}`,
    title,
    topicId,
    status,
    content: {
      id,
      title,
      topic: topicId,
      format,
      status,
      mdxKey: id,
      ...(format === 'deep-dive' ? { about: 'dsa:lc-0001', anchor: undefined } : {}),
    },
  })
}

function card(
  localId: string,
  front: string,
  deckId: string,
  tier: 'core' | 'extended',
  status: ItemStatus = 'active',
  week = 1,
): CatalogItem<'flashcard'> {
  const id = `english:${localId}`
  return cardItem({
    id,
    localId,
    title: front,
    status,
    week,
    content: { id, front, tier, status, deckId },
  })
}

function derivedCard(sourceLocalId: string, status: ItemStatus): CatalogItem<'flashcard'> {
  const localId = `explaining-code:dsa:${sourceLocalId}`
  const id = `english:${localId}`
  return derivedCardItem({
    id,
    localId,
    status,
    content: { id, status, derivedFrom: `dsa:${sourceLocalId}` },
  })
}

function exercise(localId: string, week: number, status: ItemStatus = 'active') {
  const id = `english:${localId}`
  return fillBlankItem({ id, localId, week, status, content: { id, week, status } })
}

function weeklyPrompt(localId: string, week: number, status: ItemStatus = 'active') {
  const id = `english:${localId}`
  return weeklyPromptItem({ id, localId, week, status, content: { id, week, status } })
}

function repeatablePrompt(localId: string, status: ItemStatus = 'active', trackId = 'dsa') {
  const id = `${trackId}:${localId}`
  return promptItem({ id, trackId, localId, status, content: { id, status } })
}

export const ITEMS: readonly CatalogItem[] = [
  // DSA problems
  problem(1, 'Two Sum', 'arrays-hashing'),
  problem(217, 'Contains Duplicate', 'arrays-hashing', 'draft'),
  problem(167, 'Two Sum II', 'two-pointers'),
  problem(271, 'Encode and Decode Strings', 'arrays-hashing'),
  problem(15, '3Sum', 'two-pointers', 'retired'),
  problem(121, 'Best Time to Buy and Sell Stock', 'sliding-window'),
  problem(20, 'Valid Parentheses', 'stack', 'draft'),
  problem(155, 'Min Stack', 'stack', 'draft'),
  // DSA lessons: two topic lessons, a deep-dive (not a topic lesson), a draft one
  lesson('two-pointers', 'Two pointers', 'two-pointers', 'pattern'),
  lesson('arrays-hashing', 'Arrays & hashing', 'arrays-hashing', 'pattern'),
  lesson('two-sum', 'Two Sum, từng bước', 'arrays-hashing', 'deep-dive'),
  lesson('stack', 'Stack', 'stack', 'pattern', 'draft'),
  // DSA prompts: repeatable ones are "anytime"
  repeatablePrompt('prompt-mock-interview'),
  repeatablePrompt('prompt-old-mock', 'retired'),
  // An active item of the draft track: hidden from learners with its track
  repeatablePrompt('prompt-intro', 'active', 'sysdesign'),
  // An item of the retired track: kept for its learners' history
  repeatablePrompt('prompt-legacy-drill', 'active', 'legacy'),
  // English deck cards (file order: blocker, standup, eta, retired)
  card('w01-blocker', 'blocker', 'english:deck-w01-standup', 'core'),
  card('w01-standup', 'stand-up', 'english:deck-w01-standup', 'core', 'draft'),
  card('w01-eta', 'ETA', 'english:deck-w01-standup', 'extended'),
  card('w01-legacy', 'legacy', 'english:deck-w01-standup', 'extended', 'retired'),
  // A card of the draft w02 deck: content:build gives it the stricter status, draft (load.ts)
  card('w02-lgtm', 'LGTM', 'english:deck-w02-review', 'core', 'draft', 2),
  // English exercises and weekly prompts
  exercise('ex-w01-fill-1', 1),
  exercise('ex-w02-fill-1', 2),
  exercise('ex-w02-fill-2', 2, 'draft'),
  weeklyPrompt('prompt-w01-standup-update', 1),
  weeklyPrompt('prompt-w02-review', 2, 'draft'),
  // The derived deck: one qualifying card, one retired (its note went back to draft)
  derivedCard('lc-0001', 'active'),
  derivedCard('lc-0167', 'retired'),
]

// ---------------------------------------------------------------------------------------------
// Decks and roadmaps
// ---------------------------------------------------------------------------------------------

const deck = (
  id: string,
  week: number,
  title: string,
  cardIds: string[],
  status: ItemStatus = 'active',
): DeckSummary => ({
  id,
  trackId: 'english',
  kind: 'vocabulary',
  week,
  topicId: 'standup',
  title: { vi: title, en: title },
  status,
  cardIds,
})

export const DECKS: Record<string, DeckSummary> = {
  'english:deck-w01-standup': deck('english:deck-w01-standup', 1, 'Họp stand-up', [
    'english:w01-blocker',
    'english:w01-standup',
    'english:w01-eta',
    'english:w01-legacy',
  ]),
  'english:deck-w02-review': deck(
    'english:deck-w02-review',
    2,
    'Review code',
    ['english:w02-lgtm'],
    'draft',
  ),
  'english:explaining-code': {
    id: 'english:explaining-code',
    trackId: 'english',
    kind: 'derived',
    week: null,
    topicId: null,
    title: { vi: 'Giải thích code', en: 'Explaining code' },
    status: 'active',
    cardIds: ['english:explaining-code:dsa:lc-0001', 'english:explaining-code:dsa:lc-0167'],
  },
}

export const DSA_8W: Roadmap = {
  id: '8w',
  weeks: [
    {
      week: 1,
      topics: ['arrays-hashing', 'two-pointers'],
      core: ['dsa:lc-0001', 'dsa:lc-0217', 'dsa:lc-0167'],
      bonus: ['dsa:lc-0015'],
      // 271 is introduced by the recap (no mode); Two Sum is revisited.
      recap: [{ item: 'dsa:lc-0271' }, { item: 'dsa:lc-0001', mode: 'recall' }],
      decks: [],
    },
    {
      week: 2,
      topics: ['sliding-window'],
      core: ['dsa:lc-0121'],
      bonus: [],
      recap: [
        { item: 'dsa:lc-0167', mode: 'redo' },
        { item: 'dsa:lc-0271', mode: 'explain-aloud' },
      ],
      decks: [],
    },
    {
      // [RF-4] every item of this week is a draft
      week: 3,
      topics: ['stack'],
      core: ['dsa:lc-0020'],
      bonus: ['dsa:lc-0155'],
      recap: [],
      decks: [],
    },
  ],
}

export const ENGLISH_10W: Roadmap = {
  id: '10w',
  weeks: [
    {
      week: 1,
      topics: ['standup'],
      core: [],
      bonus: [],
      recap: [],
      decks: ['english:deck-w01-standup'],
    },
    {
      week: 2,
      topics: ['code-review'],
      core: [],
      bonus: [],
      recap: [],
      decks: ['english:deck-w02-review'],
    },
  ],
}

export const FIXTURE_CATALOG: Catalog = {
  schemaVersion: 1,
  tracks: [DSA_TRACK, ENGLISH_TRACK, RETIRED_TRACK, DRAFT_TRACK].sort((a, b) =>
    a.id < b.id ? -1 : 1,
  ),
  roadmaps: { dsa: { '8w': DSA_8W }, english: { '10w': ENGLISH_10W } },
  missingRoadmaps: [
    { trackId: 'dsa', variant: '10w' },
    { trackId: 'legacy', variant: '4w' },
    { trackId: 'sysdesign', variant: '6w' },
  ],
  decks: DECKS,
  items: Object.fromEntries(ITEMS.map((item) => [item.id, item])),
  coverage: {},
}

export const FIXTURE_ACCESS: CatalogAccess = createCatalogAccess(FIXTURE_CATALOG, {
  mdx: {},
  code: {},
})
