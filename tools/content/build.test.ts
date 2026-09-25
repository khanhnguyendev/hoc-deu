import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { buildContent, isCheckMode } from './build'
import { formatLock, parseLock } from './ids-lock'
import { formatIssue, sortIssues } from './issues'

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
    expect(counts).toEqual({ problem: 4, lesson: 1, flashcard: 3, exercise: 2, prompt: 2 })
    expect(Object.keys(catalog.items)).toEqual([...Object.keys(catalog.items)].sort())
    expect(Object.keys(catalog.decks)).toEqual(['english:deck-w01-standup'])
    expect(Object.keys(catalog.roadmaps.dsa ?? {}).sort()).toEqual(['10w', '8w'])
    expect(catalog.roadmaps.english?.['10w']?.weeks[0]?.decks).toEqual(['english:deck-w01-standup'])
    expect(catalog.missingRoadmaps).toEqual([{ trackId: 'english', variant: '4w' }])
    expect(catalog.coverage).toEqual({})

    // ids.lock: every item ID, added locally.
    expect(result.lock.added).toHaveLength(12)
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

    expect(result.report).toMatch(
      /^content:build · 2 tracks · 12 items · ids\.lock \+12 · \d+\.\d s$/,
    )
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
      'content/ids.lock is missing 12 IDs — run `pnpm content:build` and commit content/ids.lock',
      'content/ids.lock is not normalised — run `pnpm content:build`',
    ])
    expect(lockOf(root)).toBeNull()
    expect(existsSync(outDir)).toBe(false)
  })

  it('an ID that left content is reported once content loads cleanly', async () => {
    const root = fixtureRoot('ok')
    await buildContent({ repoRoot: root, check: false })
    rmSync(path.join(root, 'content/tracks/dsa/problems/lc-0015-3sum'), { recursive: true })
    const result = await buildContent({ repoRoot: root, check: false })
    expect(result.issues.map(formatIssue)).toEqual([
      'content/ids.lock: `dsa:lc-0015` is in content/ids.lock but no longer in content/** — restore it, set `status: retired`, or move it to [retired] (IDs are append-only, ADR-0010)',
    ])
    expect(parseLock(lockOf(root) ?? '').lock.published).toContain('dsa:lc-0015')
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
