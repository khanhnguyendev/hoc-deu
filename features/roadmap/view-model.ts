/**
 * The track page's roadmap, as data (platform design §3.4, §3.6; task 3.4b): per roadmap week its
 * topics, topic lessons, core / recap / bonus problems, decks with their cards by tier, and the
 * week's exercises and prompts; then what belongs to no week (repeatable prompts, derived decks).
 * Pure: the catalog comes in as a `CatalogAccess`, so tests pass a fixture catalog. Items are
 * narrowed with `isItemOfType`, never switched on (§7.2).
 */
import { itemHref } from '@/features/items/href'
import { isItemOfType } from '@/features/items/narrow'
import type { ItemLink } from '@/features/items/types'
import type { CatalogAccess } from '@/lib/content/catalog-access'
import type { CatalogItem, DeckSummary } from '@/lib/content/catalog-types'
import type { ItemStatus } from '@/lib/content/schemas/common'
import type { TrackManifest } from '@/lib/content/schemas/manifest'
import type { RecapMode, Roadmap } from '@/lib/content/schemas/roadmap'

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
     * `unlocked`: the deck's cards a learner can unlock now — those whose source still qualifies
     * (not retired). Which of them this learner has unlocked (a result on the source problem)
     * needs item state and arrives with the track progress (task 5.4, decision 25).
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

/**
 * The roadmap of `track` as weeks and "anytime" content. Order: the roadmap's order (weeks, topics,
 * core, recap, bonus, decks), then catalog order (items sorted by ID; a deck's cards in file
 * order). Drafts only with `includeDrafts` (admins); retired items never. A deck none of whose
 * cards is listed is left out; a week with nothing listed stays, empty (RF-4).
 */
export function buildRoadmapView(input: {
  track: TrackManifest
  roadmap: Roadmap
  access: CatalogAccess
  includeDrafts: boolean
}): RoadmapView {
  const { track, roadmap, access, includeDrafts } = input
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
        .map((deck) => ({ deck, unlocked: cards(deck).length })),
    },
  }
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
