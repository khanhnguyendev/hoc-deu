import path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import type { CatalogItem, DeckSummary } from '@/lib/content/catalog-types'
import type { ItemStatus } from '@/lib/content/schemas/common'
import type { TrackManifest } from '@/lib/content/schemas/manifest'
import { roadmapSchema } from '@/lib/content/schemas/roadmap'
import { weekCoverage } from './coverage'
import { loadContent, type LoadedContent } from './load'

const REPO = path.resolve(import.meta.dirname, '../..')
const OK = path.join(import.meta.dirname, '__fixtures__', 'content', 'ok')

let loaded: LoadedContent
beforeAll(async () => {
  loaded = await loadContent({ repoRoot: REPO, contentDir: OK })
  expect(loaded.issues).toEqual([])
})

const trackOf = (id: string): TrackManifest => {
  const track = loaded.tracks.find((candidate) => candidate.id === id)
  if (track === undefined) throw new Error(`no track ${id}`)
  return track
}

const byId = <T extends { id: string }>(values: readonly T[]): Record<string, T> =>
  Object.fromEntries(values.map((value) => [value.id, value]))

const problemId = (n: number): string => `dsa:lc-${String(n).padStart(4, '0')}`

/** A DSA problem on arrays-hashing, with a note of the given status (or none). */
function problem(
  n: number,
  note: ItemStatus | null = null,
  status: ItemStatus = 'active',
): CatalogItem<'problem'> {
  const id = problemId(n)
  const localId = id.slice('dsa:'.length)
  return {
    id,
    type: 'problem',
    trackId: 'dsa',
    localId,
    topicId: 'arrays-hashing',
    week: null,
    status,
    title: `Problem ${n}`,
    source: `content/tracks/dsa/problems/${localId}-problem-${n}/problem.yaml`,
    content: {
      id,
      leetcode: n,
      title: `Problem ${n}`,
      difficulty: 'E',
      topic: 'arrays-hashing',
      premium: false,
      alternatives: [],
      status,
      slug: `problem-${n}`,
      url: `https://leetcode.com/problems/problem-${n}/`,
      note:
        note === null
          ? null
          : {
              status: note,
              mdxKey: `${id}#note`,
              verification: 'tested',
              languages: ['python', 'java', 'go'],
              bilingual: { vi: 'Ý tưởng', en: 'Idea' },
              complexity: { time: 'O(n)', space: 'O(1)' },
              deepDiveId: null,
            },
    },
  }
}

function lesson(
  slug: string,
  frontmatter: { format: string; topic: string; about?: string },
): CatalogItem<'lesson'> {
  const id = `dsa:lesson-${slug}`
  return {
    id,
    type: 'lesson',
    trackId: 'dsa',
    localId: `lesson-${slug}`,
    topicId: frontmatter.topic,
    week: null,
    status: 'active',
    title: slug,
    source: `content/tracks/dsa/lessons/${slug}.mdx`,
    content: {
      id,
      title: slug,
      practice: problemId(2),
      status: 'active',
      ...frontmatter,
      mdxKey: id,
      sections: [],
    },
  }
}

describe('weekCoverage', () => {
  it('counts placed problems (core + recap entries without a mode) and bonus problems apart (fix 21)', () => {
    const core = [1, 2, 3, 4, 5, 6, 7, 8]
    // Noted: 1 and 2, 9 (recap-introduced) and bonus 10. Learners see neither a draft note (3)
    // nor the note of a draft problem (4).
    const notes: Readonly<Record<number, ItemStatus>> = {
      1: 'active',
      2: 'active',
      3: 'draft',
      4: 'active',
      9: 'active',
      10: 'active',
    }
    const items = byId<CatalogItem>([
      ...[...core, 9, 10, 11].map((n) =>
        problem(n, notes[n] ?? null, n === 4 ? 'draft' : 'active'),
      ),
      lesson('two-pointers', { format: 'pattern', topic: 'two-pointers' }),
      // A deep-dive is not a topic lesson.
      lesson('two-sum', { format: 'deep-dive', topic: 'arrays-hashing', about: problemId(1) }),
    ])
    const roadmap = roadmapSchema.parse({
      id: '10w',
      weeks: [
        {
          week: 1,
          topics: ['arrays-hashing', 'two-pointers'],
          core: core.map(problemId),
          bonus: [problemId(10), problemId(11)],
          recap: [{ item: problemId(9) }, { item: problemId(1), mode: 'redo' }],
        },
      ],
    })
    expect(weekCoverage(trackOf('dsa'), roadmap, items, {})).toEqual([
      {
        week: 1,
        topics: ['arrays-hashing', 'two-pointers'],
        lessons: [
          { topic: 'arrays-hashing', lessonId: null },
          { topic: 'two-pointers', lessonId: 'dsa:lesson-two-pointers' },
        ],
        placedProblems: 9,
        notedProblems: 3,
        bonusProblems: 2,
        notedBonus: 1,
        coreCards: 0,
        extendedCards: 0,
        exercises: 0,
        prompts: 0,
      },
    ])
  })

  it("counts the active core and extended cards of the week's decks, its exercises and prompts", () => {
    const roadmap = loaded.roadmapFiles.find((file) => file.trackId === 'english')?.roadmap
    if (roadmap === undefined) throw new Error('no English roadmap')
    const decks: Record<string, DeckSummary> = byId(loaded.decks)
    // w01-heads-up is an extended card, but a draft.
    expect(weekCoverage(trackOf('english'), roadmap, byId(loaded.items), decks)).toEqual([
      {
        week: 1,
        topics: ['standup'],
        lessons: [{ topic: 'standup', lessonId: null }],
        placedProblems: 0,
        notedProblems: 0,
        bonusProblems: 0,
        notedBonus: 0,
        coreCards: 2,
        extendedCards: 0,
        exercises: 2,
        prompts: 1,
      },
    ])
  })
})
