import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { crossrefInput, crossrefIssues, deepDiveIndex, missingRoadmaps } from './crossref'
import type { ContentIssue } from './issues'
import { loadContent, type LoadedContent } from './load'

const REPO = path.resolve(import.meta.dirname, '../..')
const FIXTURES = path.join(import.meta.dirname, '__fixtures__', 'content')
const FIXTURE_DIR = 'tools/content/__fixtures__/content'

/** The repo-relative path of a file in a fixture scenario. */
const at = (scenario: string, file: string): string => `${FIXTURE_DIR}/${scenario}/${file}`

const temps: string[] = []
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true })
})

/** Load a content root; every file must load cleanly (cross-references run only then). */
async function loadClean(repoRoot: string, contentDir: string): Promise<LoadedContent> {
  const loaded = await loadContent({ repoRoot, contentDir })
  expect(loaded.issues).toEqual([])
  return loaded
}

const crossref = async (scenario: string) =>
  crossrefIssues(crossrefInput(await loadClean(REPO, path.join(FIXTURES, scenario))))

/**
 * A scenario copied to `<tmp>/content` with files written (`null` deletes one), then
 * cross-referenced: file names start `content/`.
 */
async function crossrefWith(
  scenario: string,
  files: Readonly<Record<string, string | null>>,
): Promise<ContentIssue[]> {
  const root = mkdtempSync(path.join(tmpdir(), 'content-xref-'))
  temps.push(root)
  const contentDir = path.join(root, 'content')
  cpSync(path.join(FIXTURES, scenario), contentDir, { recursive: true })
  for (const [file, text] of Object.entries(files)) {
    const abs = path.join(contentDir, file)
    if (text === null) {
      rmSync(abs, { recursive: true })
    } else {
      mkdirSync(path.dirname(abs), { recursive: true })
      writeFileSync(abs, text)
    }
  }
  return crossrefIssues(crossrefInput(await loadClean(root, contentDir)))
}

const ROADMAP = 'tracks/dsa/roadmaps/10w.yaml'
const LESSON = 'tracks/dsa/lessons/arrays-hashing.mdx'

const problemYaml = (n: number, title: string, difficulty: string, topic: string): string =>
  `id: dsa:lc-${String(n).padStart(4, '0')}\nleetcode: ${n}\ntitle: ${title}\ndifficulty: ${difficulty}\ntopic: ${topic}\n`
const PROBLEM_0001 = 'tracks/dsa/problems/lc-0001-two-sum/problem.yaml'
const PROBLEM_0217 = 'tracks/dsa/problems/lc-0217-contains-duplicate/problem.yaml'
const PROBLEM_0167 = 'tracks/dsa/problems/lc-0167-two-sum-ii-input-array-is-sorted/problem.yaml'
const TWO_SUM = problemYaml(1, 'Two Sum', 'E', 'arrays-hashing')
const CONTAINS_DUPLICATE = problemYaml(217, 'Contains Duplicate', 'E', 'arrays-hashing')
const TWO_SUM_II = problemYaml(167, 'Two Sum II - Input Array Is Sorted', 'M', 'two-pointers')

/** A lesson file of the xref manifest's formats (sections `approach`, then `practice`). */
function lesson(
  slug: string,
  frontmatter: Readonly<Record<string, string>>,
  sections: readonly string[] = ['approach', 'practice'],
): string {
  const lines = Object.entries({
    id: `dsa:lesson-${slug}`,
    title: 'Arrays & Hashing',
    ...frontmatter,
  })
  const body = sections.map((kind) =>
    kind === 'practice'
      ? `<Section kind="practice">\n\n<Practice problem="${frontmatter.practice ?? 'dsa:lc-0001'}" />\n\n</Section>`
      : `<Section kind="${kind}">\n\nDùng hash map để tra cứu trong O(1).\n\n</Section>`,
  )
  return `---\n${lines.map(([key, value]) => `${key}: ${value}`).join('\n')}\n---\n\n${body.join('\n\n')}\n`
}

const PATTERN = {
  format: 'pattern',
  topic: 'arrays-hashing',
  anchor: 'dsa:lc-0001',
  practice: 'dsa:lc-0217',
}
const DEEP_DIVE = {
  format: 'deep-dive',
  topic: 'arrays-hashing',
  about: 'dsa:lc-0001',
  practice: 'dsa:lc-0217',
}

describe('crossrefIssues — the ok fixture', () => {
  it('has no issue', async () => {
    expect(await crossref('ok')).toEqual([])
  })
})

describe('crossrefIssues — one fixture per rule, each yields exactly its issue', () => {
  const cases: [scenario: string, issue: ContentIssue][] = [
    [
      'xref-roadmap-id',
      {
        file: at('xref-roadmap-id', ROADMAP),
        path: 'id',
        message: 'must be "10w" to match the file name 10w.yaml',
      },
    ],
    [
      'xref-roadmap-item',
      {
        file: at('xref-roadmap-item', ROADMAP),
        path: 'weeks.0.core.1',
        message: 'dsa:lc-0002 is not in content/**',
      },
    ],
    [
      'xref-roadmap-deck',
      {
        file: at('xref-roadmap-deck', ROADMAP),
        path: 'weeks.0.decks.0',
        message: 'dsa:deck-w01-hashing is not in content/**',
      },
    ],
    [
      'xref-week-topic',
      {
        file: at('xref-week-topic', ROADMAP),
        path: 'weeks.0.topics.1',
        message: 'graphs is not a topic of track dsa',
      },
    ],
    [
      'xref-core-topic',
      {
        file: at('xref-core-topic', ROADMAP),
        path: 'weeks.0.core.1',
        message: "dsa:lc-0167 has topic two-pointers, not one of week 1's topics (arrays-hashing)",
      },
    ],
    [
      'xref-bonus-topic',
      {
        file: at('xref-bonus-topic', ROADMAP),
        path: 'weeks.0.bonus.0',
        message:
          'dsa:lc-0208 has topic tries: neither it nor all of its requires (trees) are in week 1 or earlier',
      },
    ],
    [
      'xref-recap-before',
      {
        file: at('xref-recap-before', ROADMAP),
        path: 'weeks.0.recap.0.item',
        message:
          'dsa:lc-0167 is recapped (redo) in week 1 but not placed (core, bonus or a recap without a mode) by then',
      },
    ],
    [
      'xref-topic-requires',
      {
        file: at('xref-topic-requires', ROADMAP),
        path: 'weeks.0.topics.0',
        message:
          'two-pointers requires arrays-hashing — list it in an earlier week or before two-pointers in this week',
      },
    ],
    [
      'xref-lesson-format',
      {
        file: at('xref-lesson-format', LESSON),
        path: 'format',
        message: 'cheatsheet is not a lesson format of track dsa (pattern, deep-dive, concept)',
      },
    ],
    [
      'xref-lesson-refs',
      {
        file: at('xref-lesson-refs', LESSON),
        path: 'anchor',
        message: 'the pattern format requires anchor',
      },
    ],
    [
      'xref-lesson-problem',
      {
        file: at('xref-lesson-problem', LESSON),
        path: 'practice',
        message: 'dsa:lc-0002 is not in content/**',
      },
    ],
    [
      'xref-lesson-rules',
      {
        file: at('xref-lesson-rules', LESSON),
        path: 'practice',
        message: 'practice must differ from anchor (anchor!=practice)',
      },
    ],
    [
      'xref-practice-component',
      {
        file: at('xref-practice-component', LESSON),
        message: `<Practice problem="dsa:lc-0001"> must be the lesson's practice, dsa:lc-0217`,
      },
    ],
    [
      'xref-item-topic',
      {
        file: at('xref-item-topic', PROBLEM_0001),
        path: 'topic',
        message: 'graphs is not a topic of track dsa',
      },
    ],
    [
      'xref-note-files',
      {
        file: at('xref-note-files', 'tracks/dsa/problems/lc-0001-two-sum/solution.go'),
        message:
          'missing — a problem with note.mdx needs a solution for every language in codeLanguages (python, go)',
      },
    ],
    [
      'xref-week-beyond',
      {
        file: at('xref-week-beyond', 'tracks/dsa/exercises/w02.yaml'),
        message: 'dsa:ex-w02-fill-1 has week 2, beyond the longest roadmap of track dsa (1 week)',
      },
    ],
    [
      'xref-derived-source',
      {
        file: at('xref-derived-source', 'tracks/english/track.yaml'),
        path: 'decks.0.from.track',
        message: 'track algo does not exist',
      },
    ],
  ]

  it.each(cases)('%s', async (scenario, issue) => {
    expect(await crossref(scenario)).toEqual([issue])
  })
})

describe('crossrefIssues — roadmaps', () => {
  it('a roadmap file the manifest does not list', async () => {
    expect(
      await crossrefWith('xref-roadmap-id', {
        [ROADMAP]: 'id: 10w\nweeks:\n  - week: 1\n    topics: [arrays-hashing]\n',
        'tracks/dsa/roadmaps/8w.yaml':
          'id: 8w\nweeks:\n  - week: 1\n    topics: [arrays-hashing]\n',
      }),
    ).toEqual([
      {
        file: 'content/tracks/dsa/roadmaps/8w.yaml',
        message: 'the track does not list roadmap 8w in roadmaps (content/tracks/dsa/track.yaml)',
      },
    ])
  })

  const week = (lists: string): string =>
    `id: 10w\nweeks:\n  - week: 1\n    topics: [arrays-hashing]\n${lists}`

  it('a roadmap item of another track, and one that is not a problem', async () => {
    expect(
      await crossrefWith('xref-roadmap-item', {
        [ROADMAP]: week(
          '    core: [dsa:lc-0001]\n    bonus: [english:lc-0001]\n    recap: [{ item: dsa:prompt-mock }]\n',
        ),
        'tracks/dsa/prompts/mock.yaml':
          "- id: dsa:prompt-mock\n  tag: mock-interview\n  repeatable: true\n  instruction: { vi: 'Phỏng vấn thử', en: 'Mock interview' }\n",
      }),
    ).toEqual([
      {
        file: 'content/tracks/dsa/roadmaps/10w.yaml',
        path: 'weeks.0.bonus.0',
        message: 'english:lc-0001 belongs to track english, not dsa',
      },
      {
        file: 'content/tracks/dsa/roadmaps/10w.yaml',
        path: 'weeks.0.recap.0.item',
        message: 'dsa:prompt-mock is a prompt, not a problem',
      },
    ])
  })

  it('a roadmap deck of another track, and one that is an item', async () => {
    expect(
      await crossrefWith('xref-roadmap-deck', {
        [ROADMAP]: week('    decks: [english:deck-w01-standup, dsa:lc-0001]\n'),
        [PROBLEM_0001]: TWO_SUM,
      }),
    ).toEqual([
      {
        file: 'content/tracks/dsa/roadmaps/10w.yaml',
        path: 'weeks.0.decks.0',
        message: 'english:deck-w01-standup belongs to track english, not dsa',
      },
      {
        file: 'content/tracks/dsa/roadmaps/10w.yaml',
        path: 'weeks.0.decks.1',
        message: 'dsa:lc-0001 is a problem, not a deck',
      },
    ])
  })

  it('a tries bonus problem may follow the trees week (its requires are there)', async () => {
    expect(
      await crossrefWith('xref-bonus-topic', {
        [ROADMAP]: [
          'id: 10w',
          'weeks:',
          '  - { week: 1, topics: [arrays-hashing], core: [dsa:lc-0001] }',
          '  - { week: 2, topics: [trees], core: [dsa:lc-0104], bonus: [dsa:lc-0208] }',
          '',
        ].join('\n'),
      }),
    ).toEqual([])
  })

  it('a recap entry without a mode is placed like a bonus problem', async () => {
    expect(
      await crossrefWith('xref-bonus-topic', {
        [ROADMAP]: [
          'id: 10w',
          'weeks:',
          '  - { week: 1, topics: [arrays-hashing], core: [dsa:lc-0001], recap: [{ item: dsa:lc-0208 }] }',
          '  - { week: 2, topics: [trees], core: [dsa:lc-0104] }',
          '',
        ].join('\n'),
      }),
    ).toEqual([
      {
        file: 'content/tracks/dsa/roadmaps/10w.yaml',
        path: 'weeks.0.recap.0.item',
        message:
          'dsa:lc-0208 has topic tries: neither it nor all of its requires (trees) are in week 1 or earlier',
      },
    ])
  })

  it('a recap entry with a mode may follow its placement in the same week or a bonus list', async () => {
    expect(
      await crossrefWith('xref-recap-before', {
        [ROADMAP]: [
          'id: 10w',
          'weeks:',
          '  - week: 1',
          '    topics: [arrays-hashing, two-pointers]',
          '    core: [dsa:lc-0001]',
          '    bonus: [dsa:lc-0167]',
          '    recap: [{ item: dsa:lc-0001, mode: redo }, { item: dsa:lc-0167, mode: recall }]',
          '',
        ].join('\n'),
      }),
    ).toEqual([])
  })
})

describe('crossrefIssues — lessons', () => {
  it('sections that are not the format list, in order', async () => {
    expect(
      await crossrefWith('xref-lesson-format', {
        [LESSON]: lesson('arrays-hashing', PATTERN, ['practice', 'approach']),
        [PROBLEM_0001]: TWO_SUM,
        [PROBLEM_0217]: CONTAINS_DUPLICATE,
      }),
    ).toEqual([
      {
        file: `content/${LESSON}`,
        line: 10,
        message:
          'sections must be approach, practice in this order (the pattern format) — found practice, approach',
      },
    ])
  })

  it('a reference the format does not use', async () => {
    expect(
      await crossrefWith('xref-lesson-refs', {
        [LESSON]: lesson('arrays-hashing', { ...PATTERN, about: 'dsa:lc-0001' }),
      }),
    ).toEqual([
      {
        file: `content/${LESSON}`,
        path: 'about',
        message: 'the pattern format does not use about',
      },
    ])
  })

  it('an anchor of another track, and an about that is not a problem', async () => {
    const issues = await crossrefWith('xref-lesson-problem', {
      [LESSON]: lesson('arrays-hashing', {
        ...PATTERN,
        anchor: 'english:lc-0001',
        practice: 'dsa:lc-0001',
      }),
      'tracks/dsa/lessons/deep.mdx': lesson('deep', {
        ...DEEP_DIVE,
        about: 'dsa:lesson-deep',
        practice: 'dsa:lc-0001',
      }),
    })
    expect(issues).toEqual([
      {
        file: `content/${LESSON}`,
        path: 'anchor',
        message: 'english:lc-0001 belongs to track english, not dsa',
      },
      {
        file: 'content/tracks/dsa/lessons/deep.mdx',
        path: 'about',
        message: 'dsa:lesson-deep is a lesson, not a problem',
      },
    ])
  })

  it('practice!=about', async () => {
    expect(
      await crossrefWith('xref-lesson-rules', {
        [LESSON]: lesson('arrays-hashing', { ...DEEP_DIVE, practice: 'dsa:lc-0001' }),
      }),
    ).toEqual([
      {
        file: `content/${LESSON}`,
        path: 'practice',
        message: 'practice must differ from about (practice!=about)',
      },
    ])
  })

  it('same-topic', async () => {
    expect(
      await crossrefWith('xref-lesson-rules', {
        [LESSON]: lesson('arrays-hashing', { ...PATTERN, anchor: 'dsa:lc-0167' }),
        [PROBLEM_0167]: TWO_SUM_II,
      }),
    ).toEqual([
      {
        file: `content/${LESSON}`,
        path: 'anchor',
        message:
          "dsa:lc-0167 has topic two-pointers, not the lesson's topic arrays-hashing (same-topic)",
      },
    ])
  })

  it('one-per-topic counts lessons that are not retired', async () => {
    const second = lesson('hashing-again', {
      ...PATTERN,
      anchor: 'dsa:lc-0217',
      practice: 'dsa:lc-0001',
    })
    const files = { [LESSON]: lesson('arrays-hashing', PATTERN) }
    expect(
      await crossrefWith('xref-lesson-rules', {
        ...files,
        'tracks/dsa/lessons/hashing-again.mdx': second,
      }),
    ).toEqual([
      {
        file: 'content/tracks/dsa/lessons/hashing-again.mdx',
        path: 'topic',
        message:
          'dsa:lesson-arrays-hashing is already the pattern lesson for arrays-hashing (one-per-topic)',
      },
    ])
    expect(
      await crossrefWith('xref-lesson-rules', {
        ...files,
        'tracks/dsa/lessons/hashing-again.mdx': second.replace(
          '---\n\n',
          'status: retired\n---\n\n',
        ),
      }),
    ).toEqual([])
  })

  it('max-1-per-about', async () => {
    expect(
      await crossrefWith('xref-lesson-rules', {
        [LESSON]: lesson('arrays-hashing', DEEP_DIVE),
        'tracks/dsa/lessons/two-sum.mdx': lesson('two-sum', DEEP_DIVE),
      }),
    ).toEqual([
      {
        file: 'content/tracks/dsa/lessons/two-sum.mdx',
        path: 'about',
        message:
          'dsa:lesson-arrays-hashing is already the deep-dive lesson about dsa:lc-0001 (max-1-per-about)',
      },
    ])
  })
})

describe('crossrefIssues — topics of items', () => {
  const fixed = { [PROBLEM_0001]: TWO_SUM }

  it('a lesson topic', async () => {
    expect(
      await crossrefWith('xref-item-topic', {
        ...fixed,
        'tracks/dsa/lessons/graphs.mdx': lesson('graphs', { format: 'concept', topic: 'graphs' }, [
          'approach',
        ]),
      }),
    ).toEqual([
      {
        file: 'content/tracks/dsa/lessons/graphs.mdx',
        path: 'topic',
        message: 'graphs is not a topic of track dsa',
      },
    ])
  })

  it('a deck topic', async () => {
    const deck = [
      'id: dsa:deck-w01-graphs',
      'kind: recall',
      'week: 1',
      'topic: graphs',
      "title: { vi: 'Đồ thị', en: 'Graphs' }",
      'cards:',
      '  - { id: dsa:w01-bfs, tier: core, front: BFS, back: Duyệt theo chiều rộng }',
      '',
    ].join('\n')
    expect(
      await crossrefWith('xref-item-topic', { ...fixed, 'tracks/dsa/decks/w01-graphs.yaml': deck }),
    ).toEqual([
      {
        file: 'content/tracks/dsa/decks/w01-graphs.yaml',
        path: 'topic',
        message: 'graphs is not a topic of track dsa',
      },
    ])
  })

  it('an exercise topic', async () => {
    const exercise = [
      '- id: dsa:ex-w01-fill-1',
      '  kind: fill-blank',
      '  week: 1',
      '  topic: graphs',
      "  instruction: { vi: 'Điền từ còn thiếu', en: 'Fill in the blank' }",
      "  text: 'BFS visits nodes level by {{blank}}.'",
      '  answers: [level]',
      '',
    ].join('\n')
    expect(
      await crossrefWith('xref-item-topic', {
        ...fixed,
        'tracks/dsa/exercises/w01.yaml': exercise,
      }),
    ).toEqual([
      {
        file: 'content/tracks/dsa/exercises/w01.yaml',
        message: 'dsa:ex-w01-fill-1: graphs is not a topic of track dsa',
      },
    ])
  })
})

describe('crossrefIssues — problem notes', () => {
  const NOTED = 'tracks/dsa/problems/lc-0001-two-sum'
  const GO = 'package main\n\nfunc twoSum(nums []int, target int) []int {\n\treturn nil\n}\n'

  it('a noted problem without tests.yaml', async () => {
    expect(
      await crossrefWith('xref-note-files', {
        [`${NOTED}/solution.go`]: GO,
        [`${NOTED}/tests.yaml`]: null,
      }),
    ).toEqual([
      {
        file: `content/${NOTED}/tests.yaml`,
        message: 'missing — a problem with note.mdx needs tests.yaml (platform design §3.5)',
      },
    ])
  })

  it('a problem without a note needs only problem.yaml (tests and solutions may come first)', async () => {
    expect(await crossrefWith('xref-note-files', { [`${NOTED}/note.mdx`]: null })).toEqual([])
  })

  it('tests.yaml below the §3.5 minimum', async () => {
    const loaded = await loadClean(REPO, path.join(FIXTURES, 'xref-note-files'))
    const input = crossrefInput(loaded)
    const files = input.problemFiles.get('dsa:lc-0001')
    const tests = files?.tests
    if (tests === null || tests === undefined) throw new Error('the fixture has no tests.yaml')
    // Three cases: example-1, negatives, zero-target (the schema would reject the file).
    const cases = tests.cases.filter((testCase) => testCase.name !== 'example-2')
    const problemFiles = new Map(input.problemFiles)
    problemFiles.set('dsa:lc-0001', { solutions: ['python', 'go'], tests: { ...tests, cases } })
    expect(crossrefIssues({ ...input, problemFiles })).toEqual([
      {
        file: at('xref-note-files', `${NOTED}/tests.yaml`),
        path: 'cases',
        message: 'needs at least 4 cases in total',
      },
    ])
  })
})

describe('crossrefIssues — weeks of exercises and prompts', () => {
  it('a prompt week beyond the longest roadmap', async () => {
    const prompt = [
      '- id: dsa:prompt-w02-review',
      '  tag: weekend-task',
      '  week: 2',
      "  instruction: { vi: 'Ôn lại tuần 2', en: 'Review week 2' }",
      '',
    ].join('\n')
    expect(
      await crossrefWith('xref-week-beyond', {
        'tracks/dsa/exercises/w02.yaml': null,
        'tracks/dsa/prompts/weekly.yaml': prompt,
      }),
    ).toEqual([
      {
        file: 'content/tracks/dsa/prompts/weekly.yaml',
        message:
          'dsa:prompt-w02-review has week 2, beyond the longest roadmap of track dsa (1 week)',
      },
    ])
  })

  it('a track without a roadmap file has nothing to compare with (decision 4)', async () => {
    expect(await crossrefWith('xref-week-beyond', { [ROADMAP]: null })).toEqual([])
  })
})

describe('crossrefIssues — derived deck sources', () => {
  const dsa = (itemTypes: string) =>
    [
      'id: dsa',
      'status: active',
      "title: { vi: 'Giải thuật', en: 'Algorithms' }",
      'accent: track-1',
      `itemTypes: [${itemTypes}]`,
      'codeLanguages: [python]',
      'srs: { intervals: [7, 21, 60], relearnDays: 3, masteredAfter: 2 }',
      'review: { recallMinutes: 5, redoFactor: 0.6 }',
      'defaults: { budgetMinutes: 60, newPerDay: null, throttle: [] }',
      'estimates: { problem: { new: { E: 20, M: 35, H: 50 } }, prompt: 10 }',
      'roadmaps: [{ id: 10w }]',
      'weeklyTemplate: { mon-fri: [{ kind: new }] }',
      '',
    ].join('\n')
  const english = readFileSync(
    path.join(FIXTURES, 'xref-derived-source/tracks/english/track.yaml'),
    'utf8',
  ).replace('track: algo', 'track: dsa')

  it('a source track that does not list problem', async () => {
    expect(
      await crossrefWith('xref-derived-source', {
        'tracks/english/track.yaml': english,
        'tracks/dsa/track.yaml': dsa('prompt'),
      }),
    ).toEqual([
      {
        file: 'content/tracks/english/track.yaml',
        path: 'decks.0.from.track',
        message: 'track dsa does not list problem in itemTypes',
      },
    ])
  })

  it('a source track with no problems yet is fine (PR A)', async () => {
    expect(
      await crossrefWith('xref-derived-source', {
        'tracks/english/track.yaml': english,
        'tracks/dsa/track.yaml': dsa('problem, prompt'),
      }),
    ).toEqual([])
  })
})

describe('missingRoadmaps', () => {
  it('lists manifest roadmaps without a file (coverage, decision 4)', async () => {
    const loaded = await loadClean(REPO, path.join(FIXTURES, 'ok'))
    expect(missingRoadmaps(loaded.tracks, crossrefInput(loaded).roadmaps)).toEqual([
      { trackId: 'english', variant: '4w' },
    ])
  })
})

describe('deepDiveIndex', () => {
  it('maps a problem to the lesson about it (§3.5 reverse lookup)', async () => {
    const input = crossrefInput(await loadClean(REPO, path.join(FIXTURES, 'ok')))
    expect(deepDiveIndex(input.items, input.tracks)).toEqual(
      new Map([['dsa:lc-0001', 'dsa:lesson-two-sum']]),
    )
  })

  it('skips a retired deep-dive', async () => {
    const input = crossrefInput(await loadClean(REPO, path.join(FIXTURES, 'ok')))
    const lesson = input.items['dsa:lesson-two-sum']
    if (lesson === undefined) throw new Error('no deep-dive in the ok fixture')
    const items = { ...input.items, [lesson.id]: { ...lesson, status: 'retired' as const } }
    expect(deepDiveIndex(items, input.tracks)).toEqual(new Map())
  })
})
