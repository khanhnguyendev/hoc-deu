/**
 * `pnpm content:build` (platform design §3.6): load and check `content/**`, check the
 * cross-references, derive cards, keep `content/ids.lock`, highlight code, emit `.generated/`, and
 * report counts, verification and coverage. Every load and lock issue is collected before the build
 * fails; the cross-references wait until every file loads cleanly (a file that failed to load
 * would only cascade into missing references), so they are reported in a second run. Nothing is
 * written unless there are no issues.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { Catalog, CatalogItem, DeckSummary } from '@/lib/content/catalog-types'
import { codeBlockKey, type CodeBundle, type HighlightedCode } from '@/lib/content/code-tokens'
import { CODE_LANGUAGES } from '@/lib/content/schemas/common'
import { weekCoverage } from './coverage'
import {
  crossrefInput,
  crossrefIssues,
  deepDiveIndex,
  missingRoadmaps,
  type CrossrefInput,
} from './crossref'
import { derivedCards } from './derived'
import { emitGenerated } from './emit'
import { createHighlighter } from './highlight'
import { diffLock, formatLock, lockIssues, parseLock, type LockDiff } from './ids-lock'
import { formatIssue, sortIssues, type ContentIssue } from './issues'
import { loadContent, type LoadedContent, type LoadedMdx } from './load'
import { decodeUtf8 } from './nfc'
import { formatReport } from './report'
import { compareNames, count } from './util'

export type BuildOptions = {
  repoRoot: string
  /** Default `<repoRoot>/content`. */
  contentDir?: string
  /** Default `<repoRoot>/.generated`. */
  outDir?: string
  /** Never write `ids.lock`; a stale one is an issue (CI, Vercel). */
  check: boolean
}

export type BuildResult = {
  ok: boolean
  issues: ContentIssue[]
  /** Null when the build failed. */
  catalog: Catalog | null
  lock: LockDiff
  /** The report (report.ts), or every issue and a count. */
  report: string
}

/** CI values that mean "not CI". */
const NOT_CI: ReadonlySet<string> = new Set(['', '0', 'false'])

/**
 * Check mode (fix 19): `--check`, or `CI` set to anything but '', '0' or 'false' — GitHub Actions
 * sets CI=true and Vercel builds CI=1, so neither ever writes the lock.
 */
export function isCheckMode(
  argv: readonly string[],
  env: Readonly<Record<string, string | undefined>>, // `process.env`
): boolean {
  if (argv.includes('--check')) return true
  const ci = env.CI
  return ci !== undefined && !NOT_CI.has(ci.trim().toLowerCase())
}

const sortedRecord = <T>(entries: readonly [string, T][]): Record<string, T> =>
  Object.fromEntries([...entries].sort(([a], [b]) => compareNames(a, b)))

type Derived = ReturnType<typeof derivedCards>

/** A noted problem with its deep-dive lesson (§3.5 reverse lookup); any other item as it is. */
function withDeepDive(item: CatalogItem, deepDives: ReadonlyMap<string, string>): CatalogItem {
  if (item.type !== 'problem' || item.content.note === null) return item
  const note = { ...item.content.note, deepDiveId: deepDives.get(item.id) ?? null }
  return { ...item, content: { ...item.content, note } }
}

/** The catalog: loaded items with their deep-dives, derived cards and decks, and coverage. */
function buildCatalog(loaded: LoadedContent, input: CrossrefInput, derived: Derived): Catalog {
  const deepDives = deepDiveIndex(input.items, loaded.tracks)
  const items = sortedRecord([
    ...loaded.items.map((item): [string, CatalogItem] => [item.id, withDeepDive(item, deepDives)]),
    ...derived.cards.map((card): [string, CatalogItem] => [card.id, card]),
  ])
  const decks = sortedRecord(
    [...loaded.decks, ...derived.decks].map((deck): [string, DeckSummary] => [deck.id, deck]),
  )
  // Coverage per track × existing roadmap × week (fix 21).
  const coverage = Object.fromEntries(
    loaded.tracks.map((track) => [
      track.id,
      Object.fromEntries(
        Object.entries(input.roadmaps[track.id] ?? {}).map(([variant, roadmap]) => [
          variant,
          weekCoverage(track, roadmap, items, decks),
        ]),
      ),
    ]),
  )
  return {
    schemaVersion: 1,
    tracks: loaded.tracks,
    roadmaps: input.roadmaps,
    missingRoadmaps: missingRoadmaps(loaded.tracks, input.roadmaps),
    decks,
    items,
    coverage,
  }
}

/**
 * Step 8: a bundle per problem with a note (its solutions and the note's fenced blocks) and per
 * lesson with fenced blocks. Runs only on content without issues (every language is allowed).
 */
async function highlightBundles(loaded: LoadedContent): Promise<Record<string, CodeBundle>> {
  const wanted = loaded.mdx.filter(
    (entry: LoadedMdx) => entry.context === 'note' || entry.facts.codeBlocks.length > 0,
  )
  if (wanted.length === 0) return {}

  const highlighter = await createHighlighter()
  try {
    const bundles: Record<string, CodeBundle> = {}
    for (const entry of wanted) {
      const blocks: [string, HighlightedCode][] = entry.facts.codeBlocks.map((block) => [
        codeBlockKey(block.lang, block.value),
        highlighter.highlight(block.value, block.lang),
      ])
      const solutions: CodeBundle['solutions'] = {}
      const files = entry.context === 'note' ? loaded.problemFiles.get(entry.itemId) : undefined
      for (const language of CODE_LANGUAGES) {
        const file = files?.solutions[language]
        if (file !== undefined) solutions[language] = highlighter.highlight(file.source, language)
      }
      bundles[entry.itemId] = { solutions, blocks: sortedRecord(blocks) }
    }
    return bundles
  } finally {
    highlighter.dispose()
  }
}

export async function buildContent(options: BuildOptions): Promise<BuildResult> {
  const started = performance.now()
  const repoRoot = path.resolve(options.repoRoot)
  const contentDir = path.resolve(options.contentDir ?? path.join(repoRoot, 'content'))
  const outDir = path.resolve(options.outDir ?? path.join(repoRoot, '.generated'))

  const loaded = await loadContent({ repoRoot, contentDir })

  // Step 9: ids.lock (decision 8).
  const lockPath = path.join(contentDir, 'ids.lock')
  const lockFile = path.relative(repoRoot, lockPath).split(path.sep).join('/')
  const read = existsSync(lockPath)
    ? decodeUtf8(lockFile, readFileSync(lockPath))
    : { ok: true as const, text: '' }
  const lockText = read.ok ? read.text : ''
  const parsedLock = parseLock(lockText)

  // Step 6: cross-references, once every file loads cleanly — a file that failed to load would
  // only cascade into missing references.
  const input = crossrefInput(loaded)
  const crossIssues = loaded.issues.length === 0 ? crossrefIssues(input) : []
  // Step 7: derived cards; a locked one whose source stopped qualifying stays, retired (decision 8).
  const derived = derivedCards({
    tracks: loaded.tracks,
    items: input.items,
    lockedIds: new Set(parsedLock.lock.published),
    manifestFiles: loaded.manifestFiles,
  })

  const lock = diffLock(
    parsedLock.lock,
    [...loaded.items, ...derived.cards].map((item) => item.id),
    lockText,
  )
  // While content has issues, an ID can be missing only because its file failed to load.
  const checkedLock = loaded.issues.length > 0 ? { ...lock, removed: [] } : lock
  const issues = sortIssues([
    ...loaded.issues,
    ...crossIssues,
    // An undecodable lock is its one issue: nothing in it can be compared.
    ...(read.ok
      ? [
          ...parsedLock.issues.map((message) => ({ file: lockFile, message })),
          ...lockIssues(checkedLock, options.check, lockFile),
        ]
      : [read.issue]),
  ])

  if (issues.length > 0) {
    const report = [...issues.map(formatIssue), `✗ ${count(issues.length, 'issue')}`].join('\n')
    return { ok: false, issues, catalog: null, lock, report }
  }

  // Steps 8 and 10: highlight and emit, then record new IDs (never in check mode).
  const catalog = buildCatalog(loaded, input, derived)
  emitGenerated({
    repoRoot,
    outDir,
    catalog,
    mdx: Object.fromEntries(loaded.mdx.map((entry) => [entry.key, entry.absPath])),
    code: await highlightBundles(loaded),
  })
  if (!options.check && (lock.added.length > 0 || !lock.normalized)) {
    const { published, retired } = parsedLock.lock
    writeFileSync(lockPath, formatLock({ published: [...published, ...lock.added], retired }))
  }

  const report = formatReport(catalog, lock, performance.now() - started)
  return { ok: true, issues: [], catalog, lock, report }
}
