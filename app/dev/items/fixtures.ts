/**
 * The /dev/items gallery's catalog items (task 3.4a): one per shape a Page or Row renders, built
 * from the feature's fixture builders (`features/items/fixtures.ts`) and the 3.3b samples — the
 * noted problem's body is `sample-note.mdx`, the lesson's `sample-lesson.mdx`, both bound to
 * `SAMPLE_BINDINGS.code` (page.tsx imports the MDX).
 */
import {
  cardItem,
  derivedCardItem,
  fillBlankItem,
  lessonItem,
  NOTE,
  premiumProblemItem,
  problemItem,
  promptItem,
  respondItem,
  rewriteItem,
  weeklyPromptItem,
} from '@/features/items/fixtures'
import type { CatalogItem } from '@/lib/content/catalog-types'

export { ADMIN, LEARNER, resolveFixtureItem } from '@/features/items/fixtures'
export { SAMPLE_BINDINGS } from '../content/fixtures'

/** Two Sum: an active, tested note (body: sample-note.mdx) with a deep-dive lesson. */
export const NOTED_PROBLEM = problemItem({
  content: { note: { ...NOTE, deepDiveId: 'dsa:lesson-two-sum' } },
})

/** A premium problem without a note: "Chưa có ghi chú" and its free alternative. */
export const PREMIUM_PROBLEM = premiumProblemItem()

/** An active problem whose note is still a draft, compile-only (shown to an admin). */
export const DRAFT_NOTE_PROBLEM = problemItem({
  id: 'dsa:lc-0217',
  localId: 'lc-0217',
  title: 'Contains Duplicate',
  source: 'content/tracks/dsa/problems/lc-0217-contains-duplicate/problem.yaml',
  content: {
    id: 'dsa:lc-0217',
    leetcode: 217,
    title: 'Contains Duplicate',
    slug: 'contains-duplicate',
    url: 'https://leetcode.com/problems/contains-duplicate/',
    note: { ...NOTE, status: 'draft', verification: 'compile-only', mdxKey: 'dsa:lc-0217#note' },
  },
})

/** A retired problem (rows only). */
export const RETIRED_PROBLEM = problemItem({
  id: 'dsa:lc-0020',
  localId: 'lc-0020',
  topicId: 'stack',
  status: 'retired',
  title: 'Valid Parentheses',
  source: 'content/tracks/dsa/problems/lc-0020-valid-parentheses/problem.yaml',
  content: {
    id: 'dsa:lc-0020',
    leetcode: 20,
    title: 'Valid Parentheses',
    topic: 'stack',
    status: 'retired',
    slug: 'valid-parentheses',
    url: 'https://leetcode.com/problems/valid-parentheses/',
    note: null,
  },
})

/** The Two Pointers pattern lesson (body: sample-lesson.mdx). */
export const PATTERN_LESSON = lessonItem()

/** A deep-dive lesson (rows only). */
export const DEEP_DIVE_LESSON = lessonItem({
  id: 'dsa:lesson-two-sum',
  localId: 'lesson-two-sum',
  topicId: 'arrays-hashing',
  title: 'Two Sum, từng bước',
  source: 'content/tracks/dsa/lessons/two-sum.mdx',
  content: {
    id: 'dsa:lesson-two-sum',
    format: 'deep-dive',
    topic: 'arrays-hashing',
    title: 'Two Sum, từng bước',
    anchor: undefined,
    about: 'dsa:lc-0001',
    practice: 'dsa:lc-0167',
    mdxKey: 'dsa:lesson-two-sum',
  },
})

/** A core vocabulary card and the derived "Explaining code" card of Two Sum. */
export const VOCABULARY_CARD = cardItem()
export const DERIVED_CARD = derivedCardItem()

/** The one draft item: an extended card (shown to an admin, with the draft notice). */
export const DRAFT_CARD = cardItem({
  id: 'english:w01-heads-up',
  localId: 'w01-heads-up',
  status: 'draft',
  title: 'heads-up',
  content: {
    id: 'english:w01-heads-up',
    tier: 'extended',
    status: 'draft',
    front: 'heads-up',
    back: 'lời báo trước',
    hint: undefined,
    usage: { pos: 'noun', register: 'informal', note: 'Thường nói "Just a heads-up: …".' },
    example: "Just a heads-up: I'll be out tomorrow afternoon.",
    pronunciation: '/ˈhedz.ʌp/ · HEADS-up',
  },
})

/** Each exercise kind. */
export const FILL_BLANK = fillBlankItem()
export const RESPOND = respondItem()
export const REWRITE = rewriteItem()

/** The repeatable mock interview (its own 45 minutes) and a weekly prompt (the estimate). */
export const REPEATABLE_PROMPT = promptItem()
export const WEEKLY_PROMPT = weeklyPromptItem()

/** Every gallery item by type, for the Row lists. */
export const ROWS: Readonly<Record<string, readonly CatalogItem[]>> = {
  problem: [NOTED_PROBLEM, PREMIUM_PROBLEM, DRAFT_NOTE_PROBLEM, RETIRED_PROBLEM],
  lesson: [PATTERN_LESSON, DEEP_DIVE_LESSON],
  flashcard: [VOCABULARY_CARD, DRAFT_CARD, DERIVED_CARD],
  exercise: [FILL_BLANK, RESPOND, REWRITE],
  prompt: [REPEATABLE_PROMPT, WEEKLY_PROMPT],
}
