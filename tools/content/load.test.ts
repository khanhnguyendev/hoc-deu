import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { ContentIssue } from './issues'
import { loadContent } from './load'

const REPO = path.resolve(import.meta.dirname, '../..')
const FIXTURES = path.join(import.meta.dirname, '__fixtures__', 'content')
const FIXTURE_DIR = 'tools/content/__fixtures__/content'

const load = (scenario: string) =>
  loadContent({ repoRoot: REPO, contentDir: path.join(FIXTURES, scenario) })

/** The repo-relative path of a file in a fixture scenario. */
const at = (scenario: string, file: string): string => `${FIXTURE_DIR}/${scenario}/${file}`

const temps: string[] = []
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true })
})

/** A copy of a scenario as `<tmp>/content`, with some files replaced. */
function copyWith(scenario: string, files: Readonly<Record<string, string>>): string {
  const root = mkdtempSync(path.join(tmpdir(), 'content-load-'))
  temps.push(root)
  const contentDir = path.join(root, 'content')
  cpSync(path.join(FIXTURES, scenario), contentDir, { recursive: true })
  for (const [file, text] of Object.entries(files)) writeFileSync(path.join(contentDir, file), text)
  return root
}

describe('loadContent — the ok fixture', () => {
  it('loads two tracks, their roadmaps and every item with no issue', async () => {
    const loaded = await load('ok')
    expect(loaded.issues).toEqual([])
    expect(loaded.tracks.map((track) => track.id)).toEqual(['dsa', 'english'])
    expect(
      loaded.roadmapFiles.map(({ trackId, variant, file, roadmap }) => [
        trackId,
        variant,
        file,
        roadmap.id,
      ]),
    ).toEqual([
      ['dsa', '10w', at('ok', 'tracks/dsa/roadmaps/10w.yaml'), '10w'],
      ['dsa', '8w', at('ok', 'tracks/dsa/roadmaps/8w.yaml'), '8w'],
      ['english', '10w', at('ok', 'tracks/english/roadmaps/10w.yaml'), '10w'],
    ])
    expect(loaded.items.map((item) => item.id).sort()).toEqual([
      'dsa:lc-0001',
      'dsa:lc-0015',
      'dsa:lc-0167',
      'dsa:lc-0217',
      'dsa:lesson-two-pointers',
      'dsa:prompt-mock-interview',
      'english:ex-w01-fill-1',
      'english:ex-w01-rewrite-1',
      'english:prompt-w01-standup-update',
      'english:w01-blocker',
      'english:w01-heads-up',
      'english:w01-on-track',
    ])
  })

  it('builds a noted problem with its slug, LeetCode URL and note', async () => {
    const { items } = await load('ok')
    expect(items.find((item) => item.id === 'dsa:lc-0001')).toEqual({
      id: 'dsa:lc-0001',
      type: 'problem',
      trackId: 'dsa',
      localId: 'lc-0001',
      topicId: 'arrays-hashing',
      week: null,
      status: 'active',
      title: 'Two Sum',
      source: at('ok', 'tracks/dsa/problems/lc-0001-two-sum/problem.yaml'),
      content: {
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
        note: {
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
        },
      },
    })
    const unnoted = items.find((item) => item.id === 'dsa:lc-0217')
    expect(unnoted?.status).toBe('draft')
    expect(unnoted?.type === 'problem' && unnoted.content.note).toBeNull()
  })

  it('builds a lesson with its MDX key and section kinds', async () => {
    const { items } = await load('ok')
    const lesson = items.find((item) => item.id === 'dsa:lesson-two-pointers')
    expect(lesson).toMatchObject({
      type: 'lesson',
      trackId: 'dsa',
      localId: 'lesson-two-pointers',
      topicId: 'two-pointers',
      week: null,
      title: 'Two pointers',
      source: at('ok', 'tracks/dsa/lessons/two-pointers.mdx'),
      content: {
        format: 'pattern',
        anchor: 'dsa:lc-0167',
        practice: 'dsa:lc-0015',
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
      },
    })
  })

  it('builds cards with their deck, week, topic and languages; a deck summary per deck file', async () => {
    const { items, decks } = await load('ok')
    expect(items.find((item) => item.id === 'english:w01-heads-up')).toMatchObject({
      type: 'flashcard',
      trackId: 'english',
      localId: 'w01-heads-up',
      topicId: 'standup',
      week: 1,
      status: 'draft',
      title: 'heads-up',
      source: at('ok', 'tracks/english/decks/w01-standup.yaml'),
      content: {
        tier: 'extended',
        deckId: 'english:deck-w01-standup',
        lang: { front: 'en', back: 'vi', hint: 'vi' },
        derivedFrom: null,
      },
    })
    expect(decks).toEqual([
      {
        id: 'english:deck-w01-standup',
        trackId: 'english',
        kind: 'vocabulary',
        week: 1,
        topicId: 'standup',
        title: { vi: 'Họp stand-up', en: 'Stand-up meetings' },
        status: 'active',
        cardIds: ['english:w01-blocker', 'english:w01-on-track', 'english:w01-heads-up'],
      },
    ])
  })

  it('builds exercises and prompts with their week; a repeatable prompt has none', async () => {
    const { items } = await load('ok')
    const pick = (id: string) => {
      const item = items.find((candidate) => candidate.id === id)
      return item && [item.type, item.topicId, item.week, item.title]
    }
    expect(pick('english:ex-w01-fill-1')).toEqual(['exercise', 'standup', 1, 'Điền từ còn thiếu'])
    expect(pick('english:prompt-w01-standup-update')).toEqual([
      'prompt',
      null,
      1,
      'Ghi âm một bản cập nhật stand-up dài 1 phút',
    ])
    expect(pick('dsa:prompt-mock-interview')).toEqual([
      'prompt',
      null,
      null,
      'Phỏng vấn thử: giải một bài trong 30 phút và nói to cách làm',
    ])
  })

  it('keeps the MDX facts and the problem files for the later steps', async () => {
    const { mdx, problemFiles } = await load('ok')
    expect(mdx.map(({ key, itemId, file, context }) => ({ key, itemId, file, context }))).toEqual([
      {
        key: 'dsa:lc-0001#note',
        itemId: 'dsa:lc-0001',
        file: at('ok', 'tracks/dsa/problems/lc-0001-two-sum/note.mdx'),
        context: 'note',
      },
      {
        key: 'dsa:lesson-two-pointers',
        itemId: 'dsa:lesson-two-pointers',
        file: at('ok', 'tracks/dsa/lessons/two-pointers.mdx'),
        context: 'lesson',
      },
    ])
    expect(mdx[1]?.facts.codeBlocks.map((block) => block.lang)).toEqual(['python'])
    expect(mdx[1]?.absPath).toBe(path.join(FIXTURES, 'ok/tracks/dsa/lessons/two-pointers.mdx'))

    const twoSum = problemFiles.get('dsa:lc-0001')
    expect(Object.keys(twoSum?.solutions ?? {})).toEqual(['python', 'java', 'go'])
    expect(twoSum?.solutions.java?.file).toBe(
      at('ok', 'tracks/dsa/problems/lc-0001-two-sum/Solution.java'),
    )
    expect(twoSum?.solutions.python?.source).toContain('class Solution:')
    expect(twoSum?.tests?.signature.kind).toBe('function')
    expect(problemFiles.get('dsa:lc-0015')).toEqual({ solutions: {}, tests: null })
  })

  it('a card inherits a draft or retired deck status', async () => {
    const root = copyWith('ok', {})
    const deckFile = path.join(root, 'content/tracks/english/decks/w01-standup.yaml')
    writeFileSync(
      deckFile,
      readFileSync(deckFile, 'utf8').replace(
        'kind: vocabulary',
        'kind: vocabulary\nstatus: retired',
      ),
    )
    const { items, decks, issues } = await loadContent({
      repoRoot: root,
      contentDir: path.join(root, 'content'),
    })
    expect(issues).toEqual([])
    expect(decks[0]?.status).toBe('retired')
    const statuses = items.filter((item) => item.type === 'flashcard').map((item) => item.status)
    expect(statuses).toEqual(['retired', 'retired', 'retired'])
  })
})

describe('loadContent — each failing scenario yields exactly its issue', () => {
  const cases: [scenario: string, issue: ContentIssue][] = [
    [
      'unknown-folder',
      {
        file: at('unknown-folder', 'tracks/dsa/notes'),
        message:
          'unexpected folder — a track folder holds only track.yaml, roadmaps/, lessons/, problems/, decks/, exercises/ and prompts/',
      },
    ],
    [
      'problem-extra-file',
      {
        file: at('problem-extra-file', 'tracks/dsa/problems/lc-0001-two-sum/Notes.md'),
        message:
          'unexpected file — a problem folder holds only problem.yaml, note.mdx, solution.py, Solution.java, solution.go and tests.yaml',
      },
    ],
    [
      'image-in-git',
      {
        file: at('image-in-git', 'tracks/dsa/lessons/diagram.png'),
        message: 'images live in the content-images bucket, not in git (OD3, ADR-0011)',
      },
    ],
    [
      'yaml-duplicate-key',
      {
        file: at('yaml-duplicate-key', 'tracks/dsa/problems/lc-0001-two-sum/problem.yaml'),
        line: 6,
        column: 1,
        message: 'Map keys must be unique',
      },
    ],
    [
      'yaml-alias',
      {
        file: at('yaml-alias', 'tracks/dsa/prompts/mock.yaml'),
        line: 4,
        column: 22,
        message: 'YAML anchors (&) and aliases (*) are not allowed — write each value out',
      },
    ],
    [
      'lesson-file-id',
      {
        file: at('lesson-file-id', 'tracks/dsa/lessons/arrays-hashing.mdx'),
        path: 'id',
        message: 'must be "dsa:lesson-arrays-hashing" to match the file name arrays-hashing.mdx',
      },
    ],
    [
      'other-track-id',
      {
        file: at('other-track-id', 'tracks/dsa/problems/lc-0001-two-sum/problem.yaml'),
        path: 'id',
        message: `"english:lc-0001" is an ID of track english — IDs in ${at('other-track-id', 'tracks/dsa')}/ start "dsa:"`,
      },
    ],
    [
      'reserved-id',
      {
        file: at('reserved-id', 'tracks/dsa/prompts/mine.yaml'),
        path: '0.id',
        message: 'IDs starting "user:" are reserved',
      },
    ],
    [
      'card-reserved-prefix',
      {
        file: at('card-reserved-prefix', 'tracks/english/decks/w01-standup.yaml'),
        path: 'cards.0.id',
        message: `a card's local ID must not start with "ex-"`,
      },
    ],
    [
      'type-not-listed',
      {
        file: at('type-not-listed', 'tracks/dsa/lessons/two-pointers.mdx'),
        message: `the track does not list lesson in itemTypes (${at('type-not-listed', 'tracks/dsa/track.yaml')})`,
      },
    ],
    [
      'image-prefix',
      {
        file: at('image-prefix', 'tracks/dsa/lessons/two-pointers.mdx'),
        line: 12,
        column: 1,
        message:
          "this item's images live under https://oelgwbxukbgaqqvociwi.supabase.co/storage/v1/object/public/content-images/dsa/lesson-two-pointers/",
      },
    ],
    [
      'track-id-folder',
      {
        file: at('track-id-folder', 'tracks/dsa/track.yaml'),
        path: 'id',
        message: '"algo" must equal the folder name "dsa"',
      },
    ],
    [
      'bad-file-name',
      {
        file: at('bad-file-name', 'tracks/dsa/lessons/Two-Pointers.mdx'),
        message:
          'a lesson file is named <slug>.mdx with [a-z0-9-] (its ID is <track>:lesson-<slug>)',
      },
    ],
  ]

  it.each(cases)('%s', async (scenario, issue) => {
    const { issues } = await load(scenario)
    expect(issues).toEqual([issue])
  })
})

describe('loadContent — more layout, YAML and MDX rules', () => {
  it('reports a missing track.yaml, a problem folder without problem.yaml and a bad folder name', async () => {
    const root = copyWith('ok', {})
    const tracks = path.join(root, 'content/tracks')
    renameSync(path.join(tracks, 'english/track.yaml'), path.join(tracks, 'english/manifest.yaml'))
    mkdirSync(path.join(tracks, 'dsa/problems/lc-0002-add-two-numbers'))
    writeFileSync(path.join(tracks, 'dsa/problems/lc-0002-add-two-numbers/note.mdx'), '## x\n')
    mkdirSync(path.join(tracks, 'dsa/problems/two-sum'))
    writeFileSync(path.join(tracks, 'dsa/problems/two-sum/problem.yaml'), 'id: dsa:lc-0001\n')
    const { issues } = await loadContent({ repoRoot: root, contentDir: path.join(root, 'content') })
    expect(issues.map((issue) => `${issue.file}: ${issue.message}`)).toEqual([
      'content/tracks/dsa/problems/lc-0002-add-two-numbers/problem.yaml: missing — every problem folder needs problem.yaml',
      'content/tracks/dsa/problems/two-sum: a problem folder is named lc-<number>-<LeetCode slug> (lc-0001-two-sum)',
      'content/tracks/english/manifest.yaml: unexpected file — a track folder holds only track.yaml, roadmaps/, lessons/, problems/, decks/, exercises/ and prompts/',
      'content/tracks/english/track.yaml: missing — every track folder needs track.yaml',
    ])
  })

  it('reports an unexpected entry in content/ and a non-core YAML tag', async () => {
    const root = copyWith('ok', {
      'README.md': '# Content\n',
      'tracks/dsa/problems/lc-0015-3sum/problem.yaml':
        'id: dsa:lc-0015\nleetcode: 15\ntitle: !!binary M1N1bQ==\ndifficulty: M\ntopic: two-pointers\n',
    })
    const { issues } = await loadContent({ repoRoot: root, contentDir: path.join(root, 'content') })
    expect(issues).toEqual([
      {
        file: 'content/README.md',
        message: 'unexpected file — content/ holds only LICENSE, ids.lock and tracks/',
      },
      {
        file: 'content/tracks/dsa/problems/lc-0015-3sum/problem.yaml',
        line: 3,
        column: 17,
        message: 'the YAML tag tag:yaml.org,2002:binary is not allowed (core tags only)',
      },
    ])
  })

  it('reports schema issues with their path, and a YAML syntax error with its position', async () => {
    const root = copyWith('ok', {
      'tracks/dsa/problems/lc-0015-3sum/problem.yaml':
        'id: dsa:lc-0015\nleetcode: 15\ntitle: 3Sum\ndifficulty: X\ntopic: two-pointers\n',
      'tracks/dsa/roadmaps/8w.yaml': 'id: 8w\nweeks: [\n',
    })
    const { issues } = await loadContent({ repoRoot: root, contentDir: path.join(root, 'content') })
    expect(issues).toEqual([
      {
        file: 'content/tracks/dsa/problems/lc-0015-3sum/problem.yaml',
        path: 'difficulty',
        message: expect.stringContaining('"E"'),
      },
      expect.objectContaining({ file: 'content/tracks/dsa/roadmaps/8w.yaml', line: 3 }),
    ])
  })

  it('a problem ID must match its folder number', async () => {
    const root = copyWith('ok', {
      'tracks/dsa/problems/lc-0015-3sum/problem.yaml':
        'id: dsa:lc-0016\nleetcode: 16\ntitle: 3Sum Closest\ndifficulty: M\ntopic: two-pointers\n',
    })
    const { issues } = await loadContent({ repoRoot: root, contentDir: path.join(root, 'content') })
    expect(issues).toEqual([
      {
        file: 'content/tracks/dsa/problems/lc-0015-3sum/problem.yaml',
        path: 'id',
        message: 'must be "dsa:lc-0015" to match the folder lc-0015-3sum',
      },
    ])
  })

  it('reports a duplicate ID across files at the second file', async () => {
    const root = copyWith('ok', {
      'tracks/english/exercises/w02.yaml': [
        '- id: english:ex-w01-fill-1',
        '  kind: fill-blank',
        '  week: 2',
        '  topic: standup',
        "  instruction: { vi: 'Điền từ', en: 'Fill in' }",
        "  text: 'Can you give me a {{blank}}?'",
        '  answers: [heads-up]',
        '',
      ].join('\n'),
    })
    const { issues } = await loadContent({ repoRoot: root, contentDir: path.join(root, 'content') })
    expect(issues).toEqual([
      {
        file: 'content/tracks/english/exercises/w02.yaml',
        path: '0.id',
        message:
          'duplicate ID english:ex-w01-fill-1 — also in content/tracks/english/exercises/w01.yaml',
      },
    ])
  })

  it('reports an MDX syntax error, and lesson frontmatter problems at their path or line', async () => {
    const root = copyWith('ok', {
      'tracks/dsa/lessons/two-pointers.mdx':
        '---\nid: dsa:lesson-two-pointers\n---\n\n<Section kind="x">\n',
      'tracks/dsa/problems/lc-0001-two-sum/note.mdx':
        '---\nstatus: [\n---\n\n## Ý\n\n<Complexity time="O(n)" space="O(n)" />\n\n<Bilingual vi="a" en="b" />\n\n<Solution />\n',
    })
    const { issues } = await loadContent({ repoRoot: root, contentDir: path.join(root, 'content') })
    expect(issues).toEqual([
      expect.objectContaining({
        file: 'content/tracks/dsa/lessons/two-pointers.mdx',
        line: 5,
        column: 1,
      }),
      // `status: [` is the frontmatter's first line, the file's second.
      expect.objectContaining({
        file: 'content/tracks/dsa/problems/lc-0001-two-sum/note.mdx',
        line: 2,
        column: 10,
      }),
    ])
  })

  it('a lesson needs frontmatter, a missing field is reported at its path, notes are checked', async () => {
    const root = copyWith('ok', {
      'tracks/dsa/lessons/two-pointers.mdx': '<Section kind="approach">\n\nx\n\n</Section>\n',
      'tracks/dsa/lessons/sliding-window.mdx':
        '---\nid: dsa:lesson-sliding-window\nformat: pattern\ntopic: two-pointers\n---\n\n<Section kind="approach">\n\nx\n\n</Section>\n',
      'tracks/dsa/problems/lc-0001-two-sum/note.mdx':
        '---\nstatus: active\n---\n\n## Ý\n\n<Bilingual vi="a" en="b" />\n\n<Solution />\n',
    })
    const { issues } = await loadContent({ repoRoot: root, contentDir: path.join(root, 'content') })
    expect(issues).toEqual([
      {
        file: 'content/tracks/dsa/lessons/sliding-window.mdx',
        path: 'title',
        message: expect.stringContaining('expected string'),
      },
      {
        file: 'content/tracks/dsa/lessons/two-pointers.mdx',
        line: 1,
        column: 1,
        message: 'a lesson starts with YAML frontmatter (`---`)',
      },
      {
        file: 'content/tracks/dsa/problems/lc-0001-two-sum/note.mdx',
        message: expect.stringContaining('Complexity'),
      },
    ])
  })

  it('a BOM in an MDX file is its only issue', async () => {
    const root = copyWith('ok', {})
    const lesson = path.join(root, 'content/tracks/dsa/lessons/two-pointers.mdx')
    writeFileSync(lesson, `\uFEFF${readFileSync(lesson, 'utf8')}`)
    const { issues } = await loadContent({ repoRoot: root, contentDir: path.join(root, 'content') })
    expect(issues).toEqual([
      {
        file: 'content/tracks/dsa/lessons/two-pointers.mdx',
        line: 1,
        column: 1,
        message: expect.stringContaining('byte order mark'),
      },
    ])
  })

  it('an NFD string in YAML and a BOM are reported ([RF-3])', async () => {
    const root = copyWith('ok', {
      'tracks/dsa/problems/lc-0015-3sum/problem.yaml': `﻿id: dsa:lc-0015\nleetcode: 15\ntitle: '${'Tổng ba số'.normalize('NFD')}'\ndifficulty: M\ntopic: two-pointers\n`,
    })
    const { issues } = await loadContent({ repoRoot: root, contentDir: path.join(root, 'content') })
    const file = 'content/tracks/dsa/problems/lc-0015-3sum/problem.yaml'
    expect(issues).toEqual([
      { file, path: 'title', message: expect.stringContaining('NFC') },
      { file, line: 1, column: 1, message: expect.stringContaining('byte order mark') },
    ])
  })
})
