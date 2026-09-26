/**
 * The track page's roadmap, as data (platform design §3.4, §3.6; task 3.4b): per roadmap week its
 * topics, topic lessons, core / recap / bonus problems, decks with their cards by tier, and the
 * week's exercises and prompts; then what belongs to no week (repeatable prompts, derived decks
 * with the cards this learner unlocked). Task 5.4 adds the learner's side (Part B-M3 decision 25):
 * the progress on the enrolled variant (`trackProgressOf`) and the Weak items (`weakItemsOf`).
 * Pure: the catalog comes in as a `CatalogAccess` (and a `PlanCatalog`), so tests pass a fixture
 * catalog. Items are narrowed with `isItemOfType`, never switched on (§7.2).
 */
import { itemHref } from '@/features/items/href'
import { isItemOfType } from '@/features/items/narrow'
import type { ItemLink } from '@/features/items/types'
import type { CatalogAccess } from '@/lib/content/catalog-access'
import type { CatalogItem, DeckSummary } from '@/lib/content/catalog-types'
import type { ItemStatus } from '@/lib/content/schemas/common'
import type { TrackManifest } from '@/lib/content/schemas/manifest'
import type { RecapMode, Roadmap } from '@/lib/content/schemas/roadmap'
import { isActiveItem, type PlanCatalog } from '@/lib/domain/catalog'
import { own } from '@/lib/domain/compare'
import { coreItemsOfWeek, roadmapWeek } from '@/lib/domain/plan/roadmap'
import type { ItemState } from '@/lib/domain/state'

/** The track list: where an item's back link goes when its track's page would be a 404. */
export const TRACKS_HREF = '/tracks'

export type WeekView = {
  week: number
  topics: { id: string; title: string }[]
  /** Topic lessons: formats that do not require `about`, topic ∈ the week's topics. */
  lessons: CatalogItem<'lesson'>[]
  core: CatalogItem<'problem'>[]
  /** `mode: null` — the entry introduces its item (e.g. 271 in DSA week 1, §5.3). */
  recap: { item: CatalogItem<'problem'>; mode: RecapMode | null }[]
  bonus: CatalogItem<'problem'>[]
  decks: {
    deck: DeckSummary
    core: CatalogItem<'flashcard'>[]
    extended: CatalogItem<'flashcard'>[]
  }[]
  /** The exercises whose `week` is this week. */
  exercises: CatalogItem<'exercise'>[]
  /** The non-repeatable prompts whose `week` is this week. */
  prompts: CatalogItem<'prompt'>[]
}

export type RoadmapView = {
  variant: string
  weeks: WeekView[]
  anytime: {
    prompts: CatalogItem<'prompt'>[]
    /**
     * `unlocked`: the deck's listed cards this learner has unlocked — a result on the card's
     * source (`lastResultOn` set, §5.3; task 5.4, the M3 residual). Retired cards never count.
     */
    derivedDecks: { deck: DeckSummary; unlocked: number }[]
  }
}

/** Learners see active content; admins also drafts (§3.3). Retired content is never listed. */
export function isListed(status: ItemStatus, includeDrafts: boolean): boolean {
  return status === 'active' || (includeDrafts && status === 'draft')
}

const notNull = <T>(value: T | null): value is T => value !== null

/** The topic's Vietnamese title (DSA topics keep their English terms), else its ID. */
function topicTitle(track: TrackManifest, id: string): string {
  return track.topics.find((topic) => topic.id === id)?.title.vi ?? id
}

/** The learner's states the roadmap reads: whether an item has a result. */
type ResultStates = Readonly<Record<string, Pick<ItemState, 'lastResultOn'>>>

/**
 * The roadmap of `track` as weeks and "anytime" content. Order: the roadmap's order (weeks, topics,
 * core, recap, bonus, decks), then catalog order (items sorted by ID; a deck's cards in file
 * order). Drafts only with `includeDrafts` (admins); retired items never. A deck none of whose
 * cards is listed is left out; a week with nothing listed stays, empty (RF-4). A derived deck
 * counts the listed cards whose source has a result in `items` (the learner's item states; none
 * without them).
 */
export function buildRoadmapView(input: {
  track: TrackManifest
  roadmap: Roadmap
  access: CatalogAccess
  includeDrafts: boolean
  items?: ResultStates
}): RoadmapView {
  const { track, roadmap, access, includeDrafts, items = {} } = input
  const unlocked = (card: CatalogItem<'flashcard'>): boolean => {
    const source = card.content.derivedFrom
    return source !== null && (own(items, source)?.lastResultOn ?? null) !== null
  }
  const listed = (item: CatalogItem | null): item is CatalogItem =>
    item !== null && item.trackId === track.id && isListed(item.status, includeDrafts)
  const trackItems = access.getTrackItems(track.id).filter(listed)

  const formats = track.lessonFormats ?? {}
  const topicLessons = trackItems.filter(
    (item): item is CatalogItem<'lesson'> =>
      isItemOfType(item, 'lesson') &&
      formats[item.content.format]?.requires.includes('about') === false,
  )
  const exercises = trackItems.filter((item): item is CatalogItem<'exercise'> =>
    isItemOfType(item, 'exercise'),
  )
  const prompts = trackItems.filter((item): item is CatalogItem<'prompt'> =>
    isItemOfType(item, 'prompt'),
  )

  const problem = (id: string): CatalogItem<'problem'> | null => {
    const item = access.getItem(id)
    return listed(item) && isItemOfType(item, 'problem') ? item : null
  }
  const cards = (deck: DeckSummary): CatalogItem<'flashcard'>[] =>
    deck.cardIds
      .map((id) => access.getItem(id))
      .filter(listed)
      .filter((item): item is CatalogItem<'flashcard'> => isItemOfType(item, 'flashcard'))
  const deckOf = (id: string): DeckSummary | null => {
    const deck = access.getDeck(id)
    return deck !== null && deck.trackId === track.id && isListed(deck.status, includeDrafts)
      ? deck
      : null
  }

  const weeks = roadmap.weeks.map((week): WeekView => ({
    week: week.week,
    topics: week.topics.map((id) => ({ id, title: topicTitle(track, id) })),
    lessons: week.topics.flatMap((topic) =>
      topicLessons.filter((lesson) => lesson.content.topic === topic),
    ),
    core: week.core.map(problem).filter(notNull),
    recap: week.recap.flatMap((entry) => {
      const item = problem(entry.item)
      return item === null ? [] : [{ item, mode: entry.mode ?? null }]
    }),
    bonus: week.bonus.map(problem).filter(notNull),
    decks: week.decks
      .map(deckOf)
      .filter(notNull)
      .map((deck) => {
        const deckCards = cards(deck)
        return {
          deck,
          core: deckCards.filter((card) => card.content.tier === 'core'),
          extended: deckCards.filter((card) => card.content.tier === 'extended'),
        }
      })
      .filter((deck) => deck.core.length + deck.extended.length > 0),
    exercises: exercises.filter((item) => item.week === week.week),
    prompts: prompts.filter((item) => !item.content.repeatable && item.week === week.week),
  }))

  return {
    variant: roadmap.id,
    weeks,
    anytime: {
      prompts: prompts.filter((item) => item.content.repeatable),
      // Manifest order; a derived deck's summary is `<track>:<deck id>`.
      derivedDecks: track.decks
        .map((deck) => deckOf(`${track.id}:${deck.id}`))
        .filter(notNull)
        .map((deck) => ({ deck, unlocked: cards(deck).filter(unlocked).length })),
    },
  }
}

/** The learner's progress on a track's variant (the track page's TrackProgress, task 5.4). */
export type TrackProgressData = {
  /** The roadmap week (`roadmapWeek`, §5.3); 1 without a roadmap. */
  readonly week: number
  /** The variant's roadmap weeks; 0 without a roadmap. */
  readonly weeks: number
  /** Introduced active core items of the variant. */
  readonly introduced: number
  /** Active core items of the variant (drafts, retired and missing ones never count). */
  readonly total: number
}

/**
 * The learner's progress on `variant` of `trackId` (Part B-M3 decision 25): week x of N as the
 * plan engine counts it (`roadmapWeek`: active core items only, decision 16 of M4), and the
 * introduced active core items out of all of them.
 */
export function trackProgressOf(
  catalog: PlanCatalog,
  trackId: string,
  variant: string,
  items: Readonly<Record<string, ItemState>>,
): TrackProgressData {
  const track = own(catalog.tracks, trackId)
  const roadmap = track === undefined ? undefined : own(track.roadmaps, variant)
  if (roadmap === undefined) return { week: 1, weeks: 0, introduced: 0, total: 0 }
  const core = new Set(
    roadmap.weeks
      .flatMap((week) => coreItemsOfWeek(week, catalog))
      .filter((id) => isActiveItem(catalog, id)),
  )
  return {
    week: roadmapWeek(roadmap, catalog, items),
    weeks: roadmap.weeks.length,
    introduced: [...core].filter((id) => own(items, id) !== undefined).length,
    total: core.size,
  }
}

/** The items of `items` whose learner state is Weak (§5.7), in order. */
export function weakItemsOf(
  items: readonly CatalogItem[],
  states: Readonly<Record<string, Pick<ItemState, 'status'>>>,
): CatalogItem[] {
  return items.filter((item) => own(states, item.id)?.status === 'weak')
}

/** Another item as a link (`resolveItem`, §3.2): problems carry `#leetcode` and difficulty. */
export function itemLinkOf(item: CatalogItem): ItemLink {
  const problem = isItemOfType(item, 'problem') ? item.content : null
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    href: itemHref(item),
    leetcode: problem?.leetcode ?? null,
    difficulty: problem?.difficulty ?? null,
  }
}

/**
 * `resolveItem` for a viewer: the link to `id`, or null when it is unknown or hidden from them — a
 * draft item, or an item of a draft track, for a learner. Retired items stay linkable (their page
 * says so).
 */
export function resolveItemLink(
  access: CatalogAccess,
  id: string,
  includeDrafts: boolean,
): ItemLink | null {
  const item = access.getItem(id)
  const track = item === null ? null : access.getTrack(item.trackId)
  if (item === null || track === null) return null
  const hidden = (status: ItemStatus) => status === 'draft' && !includeDrafts
  return hidden(item.status) || hidden(track.status) ? null : itemLinkOf(item)
}
