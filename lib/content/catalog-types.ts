/**
 * The generated catalog's shape (platform design §3.6; decision 5): `pnpm content:build` writes it
 * to `.generated/catalog.{json,ts}`. Types only, so client components may `import type` it.
 */
import type { Exercise } from './item-types/exercise'
import type { Card } from './item-types/flashcard'
import type { LessonFrontmatter } from './item-types/lesson'
import type { Problem } from './item-types/problem'
import type { Prompt } from './item-types/prompt'
import type { CodeLanguage, ItemStatus, ItemType, LocalizedText } from './schemas/common'
import type { TrackManifest } from './schemas/manifest'
import type { Roadmap } from './schemas/roadmap'
import type { Verification } from './verification'

/** A problem's `note.mdx`: its own status (a draft note hides only the note, §3.3). */
export type ProblemNote = {
  status: ItemStatus
  /** `<problem id>#note` — the key of the note in the MDX loaders. */
  mdxKey: string
  verification: Verification
  /** The solution files present, in `CODE_LANGUAGES` order. */
  languages: CodeLanguage[]
  bilingual: { vi: string; en: string }
  complexity: { time: string; space: string }
  /** The deep-dive lesson about this problem (§3.5 reverse lookup); filled by 3.2c, null until. */
  deepDiveId: string | null
}

export type ProblemContent = Problem & {
  /** The LeetCode slug, from the folder name. */
  slug: string
  /** `https://leetcode.com/problems/<slug>/` */
  url: string
  note: ProblemNote | null
}

export type LessonContent = LessonFrontmatter & {
  /** The lesson ID — the key of the lesson in the MDX loaders. */
  mdxKey: string
  /** Top-level `<Section kind>` values, in order. */
  sections: string[]
}

export type FlashcardContent = Card & {
  deckId: string
  /** The language of each side; a hint is in the back's language. */
  lang: { front: 'en' | 'vi'; back: 'en' | 'vi'; hint: 'en' | 'vi' }
  /** The source item of a derived card (3.2c); null for an authored card. */
  derivedFrom: string | null
}

/** Each type's content extends its authored shape (`AuthoredByType`), pinned by a type test. */
export type ContentByType = {
  problem: ProblemContent
  lesson: LessonContent
  flashcard: FlashcardContent
  exercise: Exercise
  prompt: Prompt
}

export type CatalogItem<K extends ItemType = ItemType> = {
  [T in K]: {
    id: string
    type: T
    trackId: string
    localId: string
    /** Problem and lesson: their own; card: its deck's; exercise: its own; prompt, derived card: null. */
    topicId: string | null
    /** The authored week: a card's deck, an exercise, a prompt; otherwise null (roadmap-dependent). */
    week: number | null
    /** For a card, the stricter of its own and its deck's status (retired > draft > active). */
    status: ItemStatus
    /** Problem title | lesson title | card front | exercise or prompt instruction.vi */
    title: string
    /** The repo-relative path of the file that defines the item. */
    source: string
    content: ContentByType[T]
  }
}[K]

export type DeckSummary = {
  id: string
  trackId: string
  kind: 'vocabulary' | 'recall' | 'derived'
  week: number | null
  topicId: string | null
  title: LocalizedText
  status: ItemStatus
  cardIds: string[]
}

/** Placed items only (core + recap entries without a mode); bonus counted separately (fix 21). */
export type WeekCoverage = {
  week: number
  topics: string[]
  lessons: { topic: string; lessonId: string | null }[]
  placedProblems: number
  notedProblems: number
  bonusProblems: number
  notedBonus: number
  coreCards: number
  extendedCards: number
  exercises: number
  prompts: number
}

export type Catalog = {
  schemaVersion: 1
  /** Sorted by ID. */
  tracks: TrackManifest[]
  /** trackId → variant → roadmap, for the roadmap files that exist. */
  roadmaps: Record<string, Record<string, Roadmap>>
  /** Manifest roadmaps without a file: coverage, not an error (decision 4). */
  missingRoadmaps: { trackId: string; variant: string }[]
  decks: Record<string, DeckSummary>
  /** Every item, drafts and retired included. */
  items: Record<string, CatalogItem>
  /** trackId → variant → weeks; `{}` until 3.2c. */
  coverage: Record<string, Record<string, WeekCoverage[]>>
}
