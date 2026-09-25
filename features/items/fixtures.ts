/**
 * Fixture catalog items, one per shape a Page or Row renders — for the unit tests and the
 * `/dev/items` gallery (`app/dev/items/fixtures.ts` composes them). Never imported by app code or
 * the feature's `index.ts`. The IDs are the real tracks' (`dsa`, `english`), so topic titles and
 * estimates come from the generated catalog's manifests.
 */
import type {
  CatalogItem,
  ContentByType,
  FlashcardContent,
  LessonContent,
  ProblemContent,
  ProblemNote,
} from '@/lib/content/catalog-types'
import type { Exercise } from '@/lib/content/item-types/exercise'
import type { Prompt } from '@/lib/content/item-types/prompt'
import type { ItemType } from '@/lib/content/schemas/common'
import { itemHref } from './href'
import type { ItemLink, ItemPageProps, ItemViewer } from './types'

/** Top-level fields to override, plus a shallow patch of `content`. */
export type ItemPatch<K extends ItemType> = Partial<Omit<CatalogItem<K>, 'type' | 'content'>> & {
  content?: Partial<ContentByType[K]>
}

function build<K extends ItemType>(base: CatalogItem<K>, patch: ItemPatch<K> = {}): CatalogItem<K> {
  const { content, ...rest } = patch
  return { ...base, ...rest, content: { ...base.content, ...content } } as CatalogItem<K>
}

// ---------------------------------------------------------------------------------------------
// Problems
// ---------------------------------------------------------------------------------------------

export const NOTE: ProblemNote = {
  status: 'active',
  mdxKey: 'dsa:lc-0001#note',
  verification: 'tested',
  languages: ['python', 'java', 'go'],
  bilingual: {
    vi: 'Lưu mỗi số vào hash map để tìm phần bù trong O(1).',
    en: 'Store each number in a hash map to look up its complement in O(1).',
  },
  complexity: { time: 'O(n)', space: 'O(n)' },
  deepDiveId: null,
}

const TWO_SUM_CONTENT: ProblemContent = {
  id: 'dsa:lc-0001',
  leetcode: 1,
  title: 'Two Sum',
  difficulty: 'E',
  topic: 'arrays-hashing',
  premium: false,
  alternatives: [],
  status: 'active',
  slug: 'two-sum',
  url: 'https://leetcode.com/problems/two-sum/',
  note: NOTE,
}

const TWO_SUM: CatalogItem<'problem'> = {
  id: 'dsa:lc-0001',
  type: 'problem',
  trackId: 'dsa',
  localId: 'lc-0001',
  topicId: 'arrays-hashing',
  week: null,
  status: 'active',
  title: 'Two Sum',
  source: 'content/tracks/dsa/problems/lc-0001-two-sum/problem.yaml',
  content: TWO_SUM_CONTENT,
}

/** Two Sum with an active, tested note (patch `content.note` for other notes). */
export const problemItem = (patch?: ItemPatch<'problem'>) => build(TWO_SUM, patch)

/** A premium problem without a note: one free alternative (§3.5). */
export const premiumProblemItem = (patch?: ItemPatch<'problem'>) =>
  build(
    build(TWO_SUM, {
      id: 'dsa:lc-0271',
      localId: 'lc-0271',
      title: 'Encode and Decode Strings',
      source: 'content/tracks/dsa/problems/lc-0271-encode-and-decode-strings/problem.yaml',
      content: {
        id: 'dsa:lc-0271',
        leetcode: 271,
        title: 'Encode and Decode Strings',
        difficulty: 'M',
        premium: true,
        alternatives: [
          { label: 'LintCode 659 (free)', url: 'https://www.lintcode.com/problem/659/' },
        ],
        slug: 'encode-and-decode-strings',
        url: 'https://leetcode.com/problems/encode-and-decode-strings/',
        note: null,
      },
    }),
    patch,
  )

// ---------------------------------------------------------------------------------------------
// Lessons
// ---------------------------------------------------------------------------------------------

const TWO_POINTERS_CONTENT: LessonContent = {
  id: 'dsa:lesson-two-pointers',
  format: 'pattern',
  topic: 'two-pointers',
  title: 'Two pointers',
  anchor: 'dsa:lc-0167',
  practice: 'dsa:lc-0015',
  status: 'active',
  mdxKey: 'dsa:lesson-two-pointers',
  sections: [
    'signals',
    'analogy',
    'visual',
    'approach',
    'code',
    'complexity',
    'bilingual',
    'practice',
    'quiz',
  ],
}

/** The Two Pointers pattern lesson (anchor 167, practice 15), like `sample-lesson.mdx`. */
export const lessonItem = (patch?: ItemPatch<'lesson'>) =>
  build<'lesson'>(
    {
      id: 'dsa:lesson-two-pointers',
      type: 'lesson',
      trackId: 'dsa',
      localId: 'lesson-two-pointers',
      topicId: 'two-pointers',
      week: null,
      status: 'active',
      title: 'Two pointers',
      source: 'content/tracks/dsa/lessons/two-pointers.mdx',
      content: TWO_POINTERS_CONTENT,
    },
    patch,
  )

// ---------------------------------------------------------------------------------------------
// Flashcards
// ---------------------------------------------------------------------------------------------

const BLOCKER_CONTENT: FlashcardContent = {
  id: 'english:w01-blocker',
  tier: 'core',
  front: 'blocker',
  back: 'vấn đề đang chặn, khiến bạn chưa làm tiếp được',
  hint: 'Hay đi với "have" hoặc "hit".',
  usage: { pos: 'noun', register: 'neutral', note: 'Thường nói "I have one blocker: …".' },
  example: "I have one blocker: I'm still waiting for access to the staging database.",
  pronunciation: '/ˈblɒk.ər/ · BLOCK-er',
  tags: [],
  status: 'active',
  deckId: 'english:deck-w01-standup',
  lang: { front: 'en', back: 'vi', hint: 'vi' },
  derivedFrom: null,
}

/** A core vocabulary card of the W1 stand-up deck. */
export const cardItem = (patch?: ItemPatch<'flashcard'>) =>
  build<'flashcard'>(
    {
      id: 'english:w01-blocker',
      type: 'flashcard',
      trackId: 'english',
      localId: 'w01-blocker',
      topicId: 'standup',
      week: 1,
      status: 'active',
      title: 'blocker',
      source: 'content/tracks/english/decks/w01-standup.yaml',
      content: BLOCKER_CONTENT,
    },
    patch,
  )

/** The "Explaining code" card derived from Two Sum's note (§3.4). */
export const derivedCardItem = (patch?: ItemPatch<'flashcard'>) =>
  build<'flashcard'>(
    {
      id: 'english:explaining-code:dsa:lc-0001',
      type: 'flashcard',
      trackId: 'english',
      localId: 'explaining-code:dsa:lc-0001',
      topicId: null,
      week: null,
      status: 'active',
      title: 'Explain the optimal approach for Two Sum in English.',
      source: 'content/tracks/english/track.yaml',
      content: {
        id: 'english:explaining-code:dsa:lc-0001',
        tier: 'derived',
        front: 'Explain the optimal approach for Two Sum in English.',
        back: NOTE.bilingual.en,
        hint: NOTE.bilingual.vi,
        tags: [],
        status: 'active',
        deckId: 'english:explaining-code',
        lang: { front: 'en', back: 'en', hint: 'vi' },
        derivedFrom: 'dsa:lc-0001',
      },
    },
    patch,
  )

// ---------------------------------------------------------------------------------------------
// Exercises
// ---------------------------------------------------------------------------------------------

function exercise(content: Exercise): CatalogItem<'exercise'> {
  const localId = content.id.split(':')[1] ?? ''
  return {
    id: content.id,
    type: 'exercise',
    trackId: 'english',
    localId,
    topicId: content.topic,
    week: content.week,
    status: content.status,
    title: content.instruction.vi,
    source: 'content/tracks/english/exercises/w01.yaml',
    content,
  }
}

const FILL_BLANK = exercise({
  id: 'english:ex-w01-fill-1',
  kind: 'fill-blank',
  week: 1,
  topic: 'standup',
  instruction: { vi: 'Điền từ còn thiếu', en: 'Fill in the blank' },
  text: "I'm {{blank}} on the API review — could someone help?",
  answers: ['blocked'],
  hint: "Từ này nghĩa là 'bị chặn, không làm tiếp được'.",
  status: 'active',
})

const RESPOND = exercise({
  id: 'english:ex-w01-respond-1',
  kind: 'respond',
  week: 1,
  topic: 'standup',
  instruction: {
    vi: 'Trả lời đồng nghiệp một cách lịch sự',
    en: 'Reply to your teammate politely',
  },
  text: 'Can you review my PR before lunch?',
  sampleAnswers: ["Sure — I'll take a look before 12 and leave comments on the PR."],
  rubric: ['clear yes or no', 'a time', 'friendly tone'],
  lang: { rubric: 'en' },
  status: 'active',
})

const REWRITE = exercise({
  id: 'english:ex-w01-rewrite-1',
  kind: 'rewrite',
  week: 1,
  topic: 'standup',
  instruction: { vi: 'Viết lại cho lịch sự và rõ ràng', en: 'Rewrite to sound polite and clear' },
  text: 'Your PR is wrong. Fix it.',
  sampleAnswers: [
    "Thanks for the PR! I think there's an issue in the retry logic — could you take a look?",
  ],
  rubric: ['polite opener', 'specific issue', 'clear ask'],
  lang: { rubric: 'en' },
  status: 'active',
})

export const fillBlankItem = (patch?: ItemPatch<'exercise'>) => build(FILL_BLANK, patch)
export const respondItem = (patch?: ItemPatch<'exercise'>) => build(RESPOND, patch)
export const rewriteItem = (patch?: ItemPatch<'exercise'>) => build(REWRITE, patch)

// ---------------------------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------------------------

function prompt(trackId: string, content: Prompt, file: string): CatalogItem<'prompt'> {
  return {
    id: content.id,
    type: 'prompt',
    trackId,
    localId: content.id.split(':')[1] ?? '',
    topicId: null,
    week: content.week ?? null,
    status: content.status,
    title: content.instruction.vi,
    source: `content/tracks/${trackId}/prompts/${file}`,
    content,
  }
}

/** The repeatable DSA mock interview (45 minutes, its own length). */
export const promptItem = (patch?: ItemPatch<'prompt'>) =>
  build(
    prompt(
      'dsa',
      {
        id: 'dsa:prompt-mock-interview',
        tag: 'mock-interview',
        instruction: {
          vi: 'Phỏng vấn thử: giải một bài trong 30 phút và nói to cách làm',
          en: 'Mock interview: solve one problem in 30 minutes and explain it aloud',
        },
        rubric: ['Nêu ý tưởng trước khi viết code', 'Phân tích độ phức tạp'],
        lang: { rubric: 'vi' },
        minutes: 45,
        repeatable: true,
        status: 'active',
      },
      'mock-interview.yaml',
    ),
    patch,
  )

/** A weekly English prompt without its own length (`estimates.prompt`); an English rubric. */
export const weeklyPromptItem = (patch?: ItemPatch<'prompt'>) =>
  build(
    prompt(
      'english',
      {
        id: 'english:prompt-w01-standup-update',
        tag: 'weekend-task',
        week: 1,
        instruction: {
          vi: 'Ghi âm một bản cập nhật stand-up dài 1 phút',
          en: 'Record a one-minute stand-up update',
        },
        rubric: ['what you did', 'what you will do', 'one blocker'],
        lang: { rubric: 'en' },
        repeatable: false,
        status: 'active',
      },
      'weekend.yaml',
    ),
    patch,
  )

// ---------------------------------------------------------------------------------------------
// Links (`resolveItem`)
// ---------------------------------------------------------------------------------------------

const link = (
  id: string,
  type: ItemType,
  title: string,
  leetcode: number | null,
  difficulty: ItemLink['difficulty'],
): ItemLink => {
  const [trackId = '', ...local] = id.split(':')
  return {
    id,
    type,
    title,
    href: itemHref({ trackId, localId: local.join(':') }),
    leetcode,
    difficulty,
  }
}

/** The items the fixtures link to: the lesson's anchor and practice, a deep-dive lesson. */
export const FIXTURE_LINKS: Readonly<Record<string, ItemLink>> = {
  'dsa:lc-0001': link('dsa:lc-0001', 'problem', 'Two Sum', 1, 'E'),
  'dsa:lc-0015': link('dsa:lc-0015', 'problem', '3Sum', 15, 'M'),
  'dsa:lc-0167': link('dsa:lc-0167', 'problem', 'Two Sum II - Input Array Is Sorted', 167, 'M'),
  'dsa:lesson-two-sum': link('dsa:lesson-two-sum', 'lesson', 'Two Sum, từng bước', null, null),
}

/** `resolveItem` over `FIXTURE_LINKS`: own keys only, null otherwise. */
export function resolveFixtureItem(id: string): ItemLink | null {
  return Object.hasOwn(FIXTURE_LINKS, id) ? (FIXTURE_LINKS[id] ?? null) : null
}

// ---------------------------------------------------------------------------------------------
// Page props
// ---------------------------------------------------------------------------------------------

export const LEARNER: ItemViewer = { codeLanguage: 'python', isAdmin: false }
export const ADMIN: ItemViewer = { codeLanguage: 'python', isAdmin: true }

/** Page props for a fixture item: a learner, no state, nothing loaded, the fixture links. */
export function pagePropsFor<K extends ItemType>(
  item: CatalogItem<K>,
  patch: Partial<Omit<ItemPageProps<K>, 'item'>> = {},
): ItemPageProps<K> {
  return {
    item,
    state: null,
    context: {},
    viewer: LEARNER,
    data: { Body: null, code: null },
    resolveItem: resolveFixtureItem,
    ...patch,
  }
}
