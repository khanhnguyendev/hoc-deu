import {
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { WeekCoverage } from '@/lib/content/catalog-types'
import { buildContent, isCheckMode } from './build'
import { formatLock, parseLock } from './ids-lock'
import { formatIssue, sortIssues } from './issues'
import { formatReport } from './report'

const REPO = path.resolve(import.meta.dirname, '../..')
const FIXTURES = path.join(import.meta.dirname, '__fixtures__', 'content')

const temps: string[] = []
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function tempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'content-build-'))
  temps.push(dir)
  return dir
}

/** A fixture scenario copied to `<tmp>/content` (the lock may be written), built into `<tmp>/.generated`. */
function fixtureRoot(scenario: string): string {
  const root = tempDir()
  cpSync(path.join(FIXTURES, scenario), path.join(root, 'content'), { recursive: true })
  return root
}

const PROMPTS = 'content/tracks/dsa/prompts/mock-interview.yaml'

const lockOf = (root: string): string | null => {
  const file = path.join(root, 'content/ids.lock')
  return existsSync(file) ? readFileSync(file, 'utf8') : null
}

describe('buildContent — the ok fixture', () => {
  it('builds the catalog with exact counts, writes the lock and the generated files', async () => {
    const root = fixtureRoot('ok')
    const result = await buildContent({ repoRoot: root, check: false })
    expect(result.issues).toEqual([])
    expect(result.ok).toBe(true)

    const catalog = result.catalog
    if (catalog === null) throw new Error('no catalog')
    expect(catalog.schemaVersion).toBe(1)
    expect(catalog.tracks.map((track) => track.id)).toEqual(['dsa', 'english'])
    const counts: Record<string, number> = {}
    for (const item of Object.values(catalog.items))
      counts[item.type] = (counts[item.type] ?? 0) + 1
    // The derived "Explaining code" card of Two Sum is a flashcard of the English track.
    expect(counts).toEqual({ problem: 4, lesson: 2, flashcard: 4, exercise: 2, prompt: 2 })
    expect(Object.keys(catalog.items)).toEqual([...Object.keys(catalog.items)].sort())
    expect(Object.keys(catalog.decks)).toEqual([
      'english:deck-w01-standup',
      'english:explaining-code',
    ])
    expect(Object.keys(catalog.roadmaps.dsa ?? {}).sort()).toEqual(['10w', '8w'])
    expect(catalog.roadmaps.english?.['10w']?.weeks[0]?.decks).toEqual(['english:deck-w01-standup'])
    expect(catalog.missingRoadmaps).toEqual([{ trackId: 'english', variant: '4w' }])

    // ids.lock: every item ID, derived ones included, added locally.
    expect(result.lock.added).toHaveLength(14)
    expect(result.lock.added).toContain('english:explaining-code:dsa:lc-0001')
    expect(result.lock.added).toEqual([...Object.keys(catalog.items)].sort())
    expect(lockOf(root)).toBe(formatLock({ published: result.lock.added, retired: [] }))

    // Generated files.
    const out = path.join(root, '.generated')
    expect(readdirSync(out).sort()).toEqual([
      'catalog.json',
      'catalog.ts',
      'code',
      'code.ts',
      'mdx.ts',
    ])
    expect(JSON.parse(readFileSync(path.join(out, 'catalog.json'), 'utf8'))).toEqual(catalog)
    expect(readdirSync(path.join(out, 'code/dsa')).sort()).toEqual([
      'lc-0001.ts',
      'lesson-two-pointers.ts',
    ])
    const mdx = readFileSync(path.join(out, 'mdx.ts'), 'utf8')
    expect(mdx).toContain(
      '"dsa:lc-0001#note": () => import("../content/tracks/dsa/problems/lc-0001-two-sum/note.mdx")',
    )
    expect(mdx).toContain(
      '"dsa:lesson-two-pointers": () => import("../content/tracks/dsa/lessons/two-pointers.mdx")',
    )

    // The report (report.test.ts pins its text); only the time differs from run to run.
    const [summary, ...rest] = result.report.split('\n')
    expect(summary).toMatch(/^content:build · 2 tracks · 14 items · ids\.lock \+14 · \d+\.\d s$/)
    expect(rest).toEqual(formatReport(catalog, result.lock, 0).split('\n').slice(1))
  })

  it('links the deep-dive, derives the card and records coverage per roadmap week', async () => {
    const root = fixtureRoot('ok')
    const { catalog } = await buildContent({ repoRoot: root, check: false })
    if (catalog === null) throw new Error('no catalog')

    const twoSum = catalog.items['dsa:lc-0001']
    expect(twoSum?.type === 'problem' && twoSum.content.note?.deepDiveId).toBe('dsa:lesson-two-sum')
    const unnoted = catalog.items['dsa:lc-0015']
    expect(unnoted?.type === 'problem' && unnoted.content.note).toBeNull()

    expect(catalog.items['english:explaining-code:dsa:lc-0001']).toMatchObject({
      type: 'flashcard',
      trackId: 'english',
      localId: 'explaining-code:dsa:lc-0001',
      status: 'active',
      content: {
        tier: 'derived',
        front: 'Explain the optimal approach for Two Sum in English.',
        back: 'Store each number in a hash map to look up its complement in O(1).',
        hint: 'Lưu mỗi số vào hash map để tìm phần bù trong O(1).',
        derivedFrom: 'dsa:lc-0001',
      },
    })
    expect(catalog.decks['english:explaining-code']).toMatchObject({
      kind: 'derived',
      cardIds: ['english:explaining-code:dsa:lc-0001'],
    })

    const week = (overrides: Partial<WeekCoverage> & Pick<WeekCoverage, 'week' | 'topics'>) => ({
      lessons: [],
      placedProblems: 0,
      notedProblems: 0,
      bonusProblems: 0,
      notedBonus: 0,
      coreCards: 0,
      extendedCards: 0,
      exercises: 0,
      prompts: 0,
      ...overrides,
    })
    const twoPointers = { topic: 'two-pointers', lessonId: 'dsa:lesson-two-pointers' }
    const arraysHashing = { topic: 'arrays-hashing', lessonId: null }
    expect(catalog.coverage).toEqual({
      dsa: {
        '10w': [
          week({
            week: 1,
            topics: ['arrays-hashing'],
            lessons: [arraysHashing],
            placedProblems: 2,
            notedProblems: 1,
          }),
          week({ week: 2, topics: ['two-pointers'], lessons: [twoPointers], placedProblems: 2 }),
        ],
        '8w': [
          week({
            week: 1,
            topics: ['arrays-hashing', 'two-pointers'],
            lessons: [arraysHashing, twoPointers],
            placedProblems: 3,
            notedProblems: 1,
            bonusProblems: 1,
          }),
        ],
      },
      english: {
        '10w': [
          week({
            week: 1,
            topics: ['standup'],
            lessons: [{ topic: 'standup', lessonId: null }],
            coreCards: 2,
            exercises: 2,
            prompts: 1,
          }),
        ],
      },
    })
  })

  it('keeps a locked derived card, retired, once its note becomes a draft (decision 8)', async () => {
    const root = fixtureRoot('ok')
    await buildContent({ repoRoot: root, check: false })
    const lock = lockOf(root)
    const note = path.join(root, 'content/tracks/dsa/problems/lc-0001-two-sum/note.mdx')
    writeFileSync(note, readFileSync(note, 'utf8').replace('status: active', 'status: draft'))
    for (const check of [false, true]) {
      const result = await buildContent({ repoRoot: root, check })
      expect(result.issues).toEqual([])
      expect(result.catalog?.items['english:explaining-code:dsa:lc-0001']?.status).toBe('retired')
      expect(lockOf(root)).toBe(lock)
    }
  })

  it('highlights the solutions and the fenced blocks into the item bundles', async () => {
    const root = fixtureRoot('ok')
    await buildContent({ repoRoot: root, check: false })
    const bundleOf = (file: string) => {
      const source = readFileSync(path.join(root, '.generated/code/dsa', file), 'utf8')
      const literal = /JSON\.parse\((".*")\)/.exec(source)?.[1] ?? '""'
      return JSON.parse(JSON.parse(literal) as string) as {
        solutions: Record<string, { lang: string; lines: unknown[] }>
        blocks: Record<string, { lang: string }>
      }
    }
    const note = bundleOf('lc-0001.ts')
    expect(Object.keys(note.solutions)).toEqual(['python', 'java', 'go'])
    expect(note.solutions.python?.lang).toBe('python')
    expect(note.solutions.python?.lines.length).toBeGreaterThan(5)
    expect(Object.values(note.blocks).map((block) => block.lang)).toEqual(['text'])
    const lesson = bundleOf('lesson-two-pointers.ts')
    expect(lesson.solutions).toEqual({})
    expect(Object.values(lesson.blocks).map((block) => block.lang)).toEqual(['python'])
  })

  it('after a local run, a second run adds nothing and check mode passes', async () => {
    const root = fixtureRoot('ok')
    await buildContent({ repoRoot: root, check: false })
    const lock = lockOf(root)
    const again = await buildContent({ repoRoot: root, check: false })
    expect(again.lock.added).toEqual([])
    expect(again.report).toContain('ids.lock +0')
    expect(lockOf(root)).toBe(lock)
    const checked = await buildContent({ repoRoot: root, check: true })
    expect(checked.issues).toEqual([])
    expect(checked.ok).toBe(true)
  })

  it('check mode never writes the lock and fails on a stale one', async () => {
    const root = fixtureRoot('ok')
    const outDir = path.join(tempDir(), 'out')
    const result = await buildContent({ repoRoot: root, outDir, check: true })
    expect(result.ok).toBe(false)
    expect(result.catalog).toBeNull()
    expect(result.issues.map((issue) => issue.message)).toEqual([
      'content/ids.lock is missing 14 IDs — run `pnpm content:build` and commit content/ids.lock',
      'content/ids.lock is not normalised — run `pnpm content:build`',
    ])
    expect(lockOf(root)).toBeNull()
    expect(existsSync(outDir)).toBe(false)
  })

  it('an ID that left content is reported once content loads cleanly', async () => {
    const root = fixtureRoot('ok')
    await buildContent({ repoRoot: root, check: false })
    // Nothing refers to the mock-interview prompt, so removing it breaks no cross-reference.
    rmSync(path.join(root, PROMPTS))
    const result = await buildContent({ repoRoot: root, check: false })
    expect(result.issues.map(formatIssue)).toEqual([
      'content/ids.lock: `dsa:prompt-mock-interview` is in content/ids.lock but no longer in content/** — restore it, set `status: retired`, or move it to [retired] (IDs are append-only, ADR-0010)',
    ])
    expect(parseLock(lockOf(root) ?? '').lock.published).toContain('dsa:prompt-mock-interview')
  })
})

describe('buildContent — ids.lock removals wait for content that loads cleanly', () => {
  it('hides a removal while another issue exists, then reports it in both modes', async () => {
    const root = fixtureRoot('ok')
    await buildContent({ repoRoot: root, check: false })
    const lock = lockOf(root)
    rmSync(path.join(root, PROMPTS))
    const problem = path.join(
      root,
      'content/tracks/dsa/problems/lc-0217-contains-duplicate/problem.yaml',
    )
    const good = readFileSync(problem, 'utf8')
    writeFileSync(problem, good.replace('difficulty: E', 'difficulty: X'))

    const held = await buildContent({ repoRoot: root, check: false })
    expect(held.issues.map((issue) => `${issue.file} ${issue.path ?? ''}`)).toEqual([
      'content/tracks/dsa/problems/lc-0217-contains-duplicate/problem.yaml difficulty',
    ])
    expect(held.lock.removed).toEqual(['dsa:lc-0217', 'dsa:prompt-mock-interview'])
    expect(lockOf(root)).toBe(lock)

    writeFileSync(problem, good)
    const removal =
      'content/ids.lock: `dsa:prompt-mock-interview` is in content/ids.lock but no longer in content/** — restore it, set `status: retired`, or move it to [retired] (IDs are append-only, ADR-0010)'
    for (const check of [false, true]) {
      const result = await buildContent({ repoRoot: root, check })
      expect(result.issues.map(formatIssue)).toEqual([removal])
      expect(lockOf(root)).toBe(lock)
    }
  })
})

describe('buildContent — ids.lock encoding', () => {
  it('an ids.lock that is not valid UTF-8 is one issue, in both modes', async () => {
    const root = fixtureRoot('ok')
    writeFileSync(path.join(root, 'content/ids.lock'), Buffer.from([0x5b, 0xff, 0x5d, 0x0a]))
    for (const check of [false, true]) {
      const result = await buildContent({ repoRoot: root, check })
      expect(result.issues).toEqual([
        { file: 'content/ids.lock', message: 'is not valid UTF-8 — save the file as UTF-8' },
      ])
    }
  })
})

describe('buildContent — determinism', () => {
  it('two runs over the ok fixture write byte-identical files', async () => {
    const root = fixtureRoot('ok')
    const out = path.join(root, '.generated')
    const snapshot = () =>
      Object.fromEntries(
        readdirSync(out, { recursive: true, withFileTypes: true })
          .filter((entry) => entry.isFile())
          .map((entry) => {
            const file = path.join(entry.parentPath, entry.name)
            return [path.relative(out, file), readFileSync(file, 'utf8')]
          }),
      )
    await buildContent({ repoRoot: root, check: false })
    const first = snapshot()
    await buildContent({ repoRoot: root, check: false })
    expect(snapshot()).toEqual(first)
    expect(Object.keys(first).sort()).toEqual([
      'catalog.json',
      'catalog.ts',
      'code.ts',
      path.join('code', 'dsa', 'lc-0001.ts'),
      path.join('code', 'dsa', 'lesson-two-pointers.ts'),
      'mdx.ts',
    ])
  })
})

describe('buildContent — a failing fixture', () => {
  it('returns sorted issues, a report of every issue, and writes nothing', async () => {
    const root = fixtureRoot('two-issues')
    const result = await buildContent({ repoRoot: root, check: false })
    expect(result.ok).toBe(false)
    expect(result.catalog).toBeNull()
    expect(result.issues).toHaveLength(2)
    expect(result.issues).toEqual(sortIssues(result.issues))
    expect(result.issues.map((issue) => issue.file)).toEqual([
      'content/tracks/dsa/notes',
      'content/tracks/dsa/problems/lc-0001-two-sum/problem.yaml',
    ])
    expect(result.report).toBe([...result.issues.map(formatIssue), '✗ 2 issues'].join('\n'))
    expect(lockOf(root)).toBeNull()
    expect(existsSync(path.join(root, '.generated'))).toBe(false)
  })

  it('reads a fixture in place through contentDir, with repo-relative file names', async () => {
    const outDir = path.join(tempDir(), 'out')
    const result = await buildContent({
      repoRoot: REPO,
      contentDir: path.join(FIXTURES, 'track-id-folder'),
      outDir,
      check: false,
    })
    expect(result.report).toBe(
      [
        'tools/content/__fixtures__/content/track-id-folder/tracks/dsa/track.yaml: id: "algo" must equal the folder name "dsa"',
        '✗ 1 issue',
      ].join('\n'),
    )
    expect(existsSync(outDir)).toBe(false)
    expect(existsSync(path.join(FIXTURES, 'track-id-folder/ids.lock'))).toBe(false)
  })
})

describe('buildContent — cross-references', () => {
  it('a cross-reference issue fails the build, and nothing is written', async () => {
    const root = fixtureRoot('xref-core-topic')
    const result = await buildContent({ repoRoot: root, check: false })
    expect(result.ok).toBe(false)
    expect(result.catalog).toBeNull()
    expect(result.report).toBe(
      [
        "content/tracks/dsa/roadmaps/10w.yaml: weeks.0.core.1: dsa:lc-0167 has topic two-pointers, not one of week 1's topics (arrays-hashing)",
        '✗ 1 issue',
      ].join('\n'),
    )
    expect(lockOf(root)).toBeNull()
    expect(existsSync(path.join(root, '.generated'))).toBe(false)
  })

  it('run once every file loads cleanly (a file that failed to load would cascade)', async () => {
    const root = fixtureRoot('xref-core-topic')
    const problem = path.join(root, 'content/tracks/dsa/problems/lc-0001-two-sum/problem.yaml')
    writeFileSync(problem, readFileSync(problem, 'utf8').replace('difficulty: E', 'difficulty: X'))
    const result = await buildContent({ repoRoot: root, check: false })
    expect(result.issues.map((issue) => `${issue.file} ${issue.path ?? ''}`)).toEqual([
      'content/tracks/dsa/problems/lc-0001-two-sum/problem.yaml difficulty',
    ])
  })
})

describe('isCheckMode', () => {
  it.each([
    [['--check'], {}, true],
    [[], { CI: '1' }, true],
    [[], { CI: 'true' }, true],
    [[], { CI: '0' }, false],
    [[], { CI: 'false' }, false],
    [[], { CI: '' }, false],
    [[], {}, false],
    [['--check'], { CI: 'false' }, true],
  ] as const)('argv %j, env %j → %s', (argv, env, expected) => {
    expect(isCheckMode(argv, env)).toBe(expected)
  })
})

describe('the real repository', () => {
  // Fix 7: only this is asserted about the real content, so content PRs never touch this test.
  it('builds in check mode with no issue', async () => {
    const result = await buildContent({
      repoRoot: REPO,
      outDir: path.join(tempDir(), 'out'),
      check: true,
    })
    expect(result.issues).toEqual([])
    expect(result.ok).toBe(true)
  })
})
