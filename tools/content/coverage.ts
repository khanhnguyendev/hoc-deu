/**
 * Content coverage per roadmap week (platform design §3.6 step 5, decision 4, fix 21): which week
 * topics have their topic lesson, how many placed and bonus problems have notes, and the week's
 * cards, exercises and prompts. Only what learners see counts: active lessons, notes, cards,
 * exercises and prompts. Missing content is coverage, never an error.
 */
import type { CatalogItem, DeckSummary, WeekCoverage } from '@/lib/content/catalog-types'
import type { TrackManifest } from '@/lib/content/schemas/manifest'
import { placedItems, type Roadmap } from '@/lib/content/schemas/roadmap'
import { byId } from './util'

/** An active problem with an active note. */
const isNoted = (item: CatalogItem | undefined): boolean =>
  item?.type === 'problem' && item.status === 'active' && item.content.note?.status === 'active'

export function weekCoverage(
  track: TrackManifest,
  roadmap: Roadmap,
  items: Readonly<Record<string, CatalogItem>>,
  decks: Readonly<Record<string, DeckSummary>>,
): WeekCoverage[] {
  const trackItems = Object.values(items)
    .filter((item) => item.trackId === track.id && item.status === 'active')
    .sort(byId)
  const formats = track.lessonFormats ?? {}
  // Topic lessons: formats without `about` (a deep-dive is about a problem, not a week topic).
  const topicLessons = trackItems.filter(
    (item): item is CatalogItem<'lesson'> =>
      item.type === 'lesson' && formats[item.content.format]?.requires.includes('about') === false,
  )
  const noted = (ids: readonly string[]) => ids.filter((id) => isNoted(items[id])).length
  const inWeek = (type: 'exercise' | 'prompt', week: number) =>
    trackItems.filter((item) => item.type === type && item.week === week).length

  return roadmap.weeks.map((week) => {
    const placed = placedItems(week)
    const cards = week.decks
      .flatMap((deckId) => decks[deckId]?.cardIds ?? [])
      .map((id) => items[id])
      .filter((item): item is CatalogItem<'flashcard'> => item?.type === 'flashcard')
      .filter((card) => card.status === 'active')
    return {
      week: week.week,
      topics: week.topics,
      lessons: week.topics.map((topic) => ({
        topic,
        lessonId: topicLessons.find((lesson) => lesson.content.topic === topic)?.id ?? null,
      })),
      placedProblems: placed.length,
      notedProblems: noted(placed),
      bonusProblems: week.bonus.length,
      notedBonus: noted(week.bonus),
      coreCards: cards.filter((card) => card.content.tier === 'core').length,
      extendedCards: cards.filter((card) => card.content.tier === 'extended').length,
      exercises: inWeek('exercise', week.week),
      prompts: inWeek('prompt', week.week),
    }
  })
}
