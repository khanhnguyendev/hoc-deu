/**
 * The item-type cores by type (platform design §3.2, §7.6) — the non-UI half of the registry, for
 * `content:build`, the bot API validation and the CLI. No React.
 */
import type { ItemType } from '../schemas/common'
import { exerciseType, type Exercise } from './exercise'
import { flashcardType, type Card } from './flashcard'
import { lessonType, type LessonFrontmatter } from './lesson'
import { problemType, type Problem } from './problem'
import { promptType, type Prompt } from './prompt'
import type { ItemTypeCore } from './types'

export type AuthoredByType = {
  problem: Problem
  lesson: LessonFrontmatter
  flashcard: Card
  exercise: Exercise
  prompt: Prompt
}

export const ITEM_TYPE_CORES: { readonly [K in ItemType]: ItemTypeCore<AuthoredByType[K]> } = {
  problem: problemType,
  lesson: lessonType,
  flashcard: flashcardType,
  exercise: exerciseType,
  prompt: promptType,
}

export function getItemTypeCore<K extends ItemType>(type: K): ItemTypeCore<AuthoredByType[K]> {
  const core: ItemTypeCore<AuthoredByType[K]> | undefined = ITEM_TYPE_CORES[type]
  if (core === undefined) throw new Error(`Unknown item type: ${String(type)}`)
  return core
}

export type { ItemTypeCore, Mode, Outcome } from './types'
