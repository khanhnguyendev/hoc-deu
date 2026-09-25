/**
 * The item-type registry (platform design §3.2, §7.6): each type's core
 * (`lib/content/item-types`) joined with its Page, Row and `load`. Adding an item type is one core
 * file, one folder here and one line below (ADR-0009). Server-only: `load` reads the generated
 * catalog's lazy MDX and code modules.
 */
import 'server-only'
import { loadCode, loadMdx } from '@/lib/content/catalog'
import type { CatalogItem } from '@/lib/content/catalog-types'
import { ITEM_TYPE_CORES } from '@/lib/content/item-types'
import type { ItemType } from '@/lib/content/schemas/common'
import { ExercisePage } from './exercise/Page'
import { ExerciseRow } from './exercise/Row'
import { FlashcardPage } from './flashcard/Page'
import { FlashcardRow } from './flashcard/Row'
import { LessonPage } from './lesson/Page'
import { LessonRow } from './lesson/Row'
import { ProblemPage } from './problem/Page'
import { ProblemRow } from './problem/Row'
import { PromptPage } from './prompt/Page'
import { PromptRow } from './prompt/Row'
import type { ItemPageData, ItemTypeDef } from './types'

/** Flashcards, exercises and prompts render from their catalog data alone. */
const nothingToLoad = async (): Promise<ItemPageData> => ({ Body: null, code: null })

/** A problem: its note's MDX (when it has a note) and its highlighted solutions. */
async function loadProblem(item: CatalogItem<'problem'>): Promise<ItemPageData> {
  const note = item.content.note
  const [Body, code] = await Promise.all([
    note === null ? null : loadMdx(note.mdxKey),
    loadCode(item.id),
  ])
  return { Body, code }
}

/** A lesson: its MDX and its highlighted fenced blocks. */
async function loadLesson(item: CatalogItem<'lesson'>): Promise<ItemPageData> {
  const [Body, code] = await Promise.all([loadMdx(item.content.mdxKey), loadCode(item.id)])
  return { Body, code }
}

export const ITEM_REGISTRY: { readonly [K in ItemType]: ItemTypeDef<K> } = {
  problem: { ...ITEM_TYPE_CORES.problem, Page: ProblemPage, Row: ProblemRow, load: loadProblem },
  lesson: { ...ITEM_TYPE_CORES.lesson, Page: LessonPage, Row: LessonRow, load: loadLesson },
  flashcard: {
    ...ITEM_TYPE_CORES.flashcard,
    Page: FlashcardPage,
    Row: FlashcardRow,
    load: nothingToLoad,
  },
  exercise: {
    ...ITEM_TYPE_CORES.exercise,
    Page: ExercisePage,
    Row: ExerciseRow,
    load: nothingToLoad,
  },
  prompt: { ...ITEM_TYPE_CORES.prompt, Page: PromptPage, Row: PromptRow, load: nothingToLoad },
}

/** The registered type; throws for a type the registry does not know (own keys only). */
export function getItemType<K extends ItemType>(type: K): ItemTypeDef<K> {
  if (!Object.hasOwn(ITEM_REGISTRY, type)) throw new Error(`Unknown item type: ${String(type)}`)
  return ITEM_REGISTRY[type]
}
