/**
 * `content:build` steps 1–5 (platform design §3.3, §3.6): walk `content/`, check its layout, parse
 * every YAML file safely and validate it, check NFC ([RF-3]), build every item with the file/ID
 * rules of decision 9, and check every MDX file. Every issue is collected; nothing throws on bad
 * content.
 */
import { readdirSync, readFileSync, statSync, type Dirent } from 'node:fs'
import path from 'node:path'
import { isAlias, LineCounter, parseDocument, visit } from 'yaml'
import type { z } from 'zod'
import type {
  CatalogItem,
  DeckSummary,
  ProblemContent,
  ProblemNote,
} from '@/lib/content/catalog-types'
import { exercisesFileSchema } from '@/lib/content/item-types/exercise'
import { deckFileSchema, type DeckFile } from '@/lib/content/item-types/flashcard'
import { lessonFrontmatterSchema } from '@/lib/content/item-types/lesson'
import { noteFrontmatterSchema, problemSchema } from '@/lib/content/item-types/problem'
import { promptsFileSchema } from '@/lib/content/item-types/prompt'
import {
  CODE_LANGUAGES,
  type CodeLanguage,
  type ItemStatus,
  type ItemType,
} from '@/lib/content/schemas/common'
import {
  LOCAL_ID_PATTERN,
  LOCAL_ID_PREFIX,
  parseItemId,
  parseProblemFolder,
  prefixedItemIdSchema,
  problemLocalId,
  RESERVED_TRACK_ID,
  SLUG_PATTERN,
  TRACK_ID_PATTERN,
} from '@/lib/content/schemas/ids'
import { trackManifestSchema, type TrackManifest } from '@/lib/content/schemas/manifest'
import { roadmapSchema, type Roadmap } from '@/lib/content/schemas/roadmap'
import { testsFileSchema, type TestsFile } from '@/lib/content/schemas/tests'
import { verificationFor } from '@/lib/content/verification'
import type { MdxContext } from './allowlist'
import { sortIssues, type ContentIssue } from './issues'
import { mdxFacts, type MdxFacts } from './mdx/facts'
import { parseMdx, type MdxRoot } from './mdx/parse'
import { checkMdx } from './mdx/safety'
import { bomIssue, decodeUtf8, nfcIssues, nfcSourceIssue } from './nfc'

export type LoadOptions = { repoRoot: string; contentDir: string }

export type LoadedRoadmap = { trackId: string; variant: string; file: string; roadmap: Roadmap }

/** A checked MDX file: a lesson (key = its ID) or a problem note (key = `<problem ID>#note`). */
export type LoadedMdx = {
  key: string
  itemId: string
  /** Repo-relative. */
  file: string
  absPath: string
  context: MdxContext
  facts: MdxFacts
}

export type SolutionFile = { file: string; source: string }

/** What a problem folder holds besides `problem.yaml` and `note.mdx`. */
export type ProblemFiles = {
  /** In `CODE_LANGUAGES` order. */
  solutions: Partial<Record<CodeLanguage, SolutionFile>>
  tests: TestsFile | null
}

export type LoadedContent = {
  /** Valid manifests, sorted by ID. */
  tracks: TrackManifest[]
  /** Track ID → the repo-relative path of its valid manifest. */
  manifestFiles: Map<string, string>
  /** Sorted by track, then file name. */
  roadmapFiles: LoadedRoadmap[]
  /** Items whose file and ID are valid, in file order. */
  items: CatalogItem[]
  decks: DeckSummary[]
  /** Sorted by key. */
  mdx: LoadedMdx[]
  /** By problem ID. */
  problemFiles: Map<string, ProblemFiles>
  /** Sorted. */
  issues: ContentIssue[]
}

// -----------------------------------------------------------------------------------------------
// Layout rules (decision 9, §3.3)
// -----------------------------------------------------------------------------------------------

const IMAGES_IN_GIT = 'images live in the content-images bucket, not in git (OD3, ADR-0011)'
/** Content files are small text; a bigger file is a mistake (or an attempt to slow the build). */
const MAX_FILE_BYTES = 512 * 1024
const IMAGE_FILE = /\.(?:svg|png|webp|jpe?g|gif)$/i
/** macOS Finder metadata: git-ignored, so it never reaches CI; not a content file. */
const OS_METADATA = '.DS_Store'

const ROOT_RULE = 'content/ holds only LICENSE, ids.lock and tracks/'
const TRACKS_RULE = 'tracks/ holds only track folders'
const TRACK_RULE =
  'a track folder holds only track.yaml, roadmaps/, lessons/, problems/, decks/, exercises/ and prompts/'
const PROBLEM_RULE =
  'a problem folder holds only problem.yaml, note.mdx, solution.py, Solution.java, solution.go and tests.yaml'
const TRACK_FOLDER_RULE = `a track folder is named by its track ID: [a-z][a-z0-9-], at most 32 characters, not "${RESERVED_TRACK_ID}"`
const PROBLEM_FOLDER_RULE =
  'a problem folder is named lc-<number>-<LeetCode slug> (lc-0001-two-sum)'

/** A problem folder's solution file per code language. */
export const SOLUTION_FILES: { readonly [K in CodeLanguage]: string } = {
  python: 'solution.py',
  java: 'Solution.java',
  go: 'solution.go',
}
const PROBLEM_FILES: ReadonlySet<string> = new Set([
  'problem.yaml',
  'note.mdx',
  'tests.yaml',
  ...Object.values(SOLUTION_FILES),
])

/** A folder of one kind of file: its extension and its name rule. */
type FileFolder = {
  extension: '.yaml' | '.mdx'
  /** The name without the extension is valid. */
  valid: (base: string) => boolean
  rule: string
}

const isLocalId = (id: string): boolean => LOCAL_ID_PATTERN.test(id)
/** `[a-z0-9-.]`, starting with a letter or digit. */
const PLAIN_NAME = /^[a-z0-9][a-z0-9.-]*$/

const FOLDERS = {
  roadmaps: {
    extension: '.yaml',
    valid: (base) => SLUG_PATTERN.test(base),
    rule: 'a roadmap file is named <variant>.yaml with [a-z0-9-] (8w.yaml)',
  },
  lessons: {
    extension: '.mdx',
    valid: (base) => isLocalId(`${LOCAL_ID_PREFIX.lesson}${base}`),
    rule: 'a lesson file is named <slug>.mdx with [a-z0-9-] (its ID is <track>:lesson-<slug>)',
  },
  decks: {
    extension: '.yaml',
    valid: (base) => isLocalId(`${LOCAL_ID_PREFIX.deck}${base}`),
    rule: 'a deck file is named <slug>.yaml with [a-z0-9-] (its ID is <track>:deck-<slug>)',
  },
  exercises: {
    extension: '.yaml',
    valid: (base) => PLAIN_NAME.test(base),
    rule: 'an exercises file is named <name>.yaml with [a-z0-9-.]',
  },
  prompts: {
    extension: '.yaml',
    valid: (base) => PLAIN_NAME.test(base),
    rule: 'a prompts file is named <name>.yaml with [a-z0-9-.]',
  },
} as const satisfies Record<string, FileFolder>

const TRACK_FOLDERS: ReadonlySet<string> = new Set([...Object.keys(FOLDERS), 'problems'])

// -----------------------------------------------------------------------------------------------
// State
// -----------------------------------------------------------------------------------------------

type Loader = {
  repoRoot: string
  issues: ContentIssue[]
  tracks: TrackManifest[]
  manifestFiles: Map<string, string>
  roadmapFiles: LoadedRoadmap[]
  /** Items with the YAML path of their ID, for the duplicate check. */
  items: { item: CatalogItem; idPath: string | undefined }[]
  decks: DeckSummary[]
  mdx: LoadedMdx[]
  problemFiles: Map<string, ProblemFiles>
}

/** A track folder being loaded. */
type Track = { id: string; dir: string; manifest: TrackManifest | null }

const compareNames = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

/** The repo-relative, `/`-separated path of `abs`. */
const labelOf = (loader: Loader, abs: string): string =>
  path.relative(loader.repoRoot, abs).split(path.sep).join('/')

function report(loader: Loader, abs: string, message: string, extra: Partial<ContentIssue> = {}) {
  loader.issues.push({ file: labelOf(loader, abs), ...extra, message })
}

function unexpected(loader: Loader, abs: string, entry: Dirent, rule: string): void {
  report(loader, abs, `unexpected ${entry.isDirectory() ? 'folder' : 'file'} — ${rule}`)
}

/**
 * A folder's files and folders, sorted by name. Symbolic links, image files and anything else are
 * reported here, once, and left out.
 */
function scan(loader: Loader, dir: string): Dirent[] {
  const entries = readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.name !== OS_METADATA)
    .sort((a, b) => compareNames(a.name, b.name))
  return entries.filter((entry) => {
    const abs = path.join(dir, entry.name)
    if (entry.isSymbolicLink()) report(loader, abs, 'symbolic links are not allowed in content/')
    else if (entry.isFile() && IMAGE_FILE.test(entry.name)) report(loader, abs, IMAGES_IN_GIT)
    else if (entry.isFile() || entry.isDirectory()) return true
    else report(loader, abs, 'only files and folders are allowed in content/')
    return false
  })
}

/** A content file's text: at most 512 KB of valid UTF-8; otherwise an issue and null. */
function readText(loader: Loader, abs: string): string | null {
  const file = labelOf(loader, abs)
  const size = statSync(abs).size
  if (size > MAX_FILE_BYTES) {
    loader.issues.push({
      file,
      message: `is ${Math.ceil(size / 1024)} KB — a content file is at most ${MAX_FILE_BYTES / 1024} KB`,
    })
    return null
  }
  const decoded = decodeUtf8(file, readFileSync(abs))
  if (decoded.ok) return decoded.text
  loader.issues.push(decoded.issue)
  return null
}

// -----------------------------------------------------------------------------------------------
// YAML (§3.6: a safe parser) and Zod
// -----------------------------------------------------------------------------------------------

/** The YAML 1.2 core schema's tags; anything else (`!!binary`, `!custom`) is rejected. */
const CORE_TAGS: ReadonlySet<string> = new Set(
  ['map', 'seq', 'str', 'null', 'bool', 'int', 'float'].map((name) => `tag:yaml.org,2002:${name}`),
)
const ANCHORS = 'YAML anchors (&) and aliases (*) are not allowed — write each value out'
const DIRECTIVES =
  'YAML directives (%YAML, %TAG) are not allowed — content is YAML 1.2 (core schema)'

/**
 * The line of a directive (`%YAML 1.1`, `%TAG …`) in the prologue, before any content, or null.
 * Unpinned, `%YAML 1.1` switches a file to YAML 1.1 types (`yes` → true, `1:20` → 80) with no tag
 * to see; `parseYaml` pins 1.2 core and rejects directives as well.
 */
function directiveLine(text: string): number | null {
  const lines = text.split('\n')
  for (const [index, line] of lines.entries()) {
    if (line.startsWith('%')) return index + 1
    if (line.trim() !== '' && !line.trimStart().startsWith('#')) return null
  }
  return null
}

type Parsed = { ok: true; value: unknown } | { ok: false }

/**
 * Parse one YAML document as YAML 1.2 with the core schema: parse errors (duplicate keys
 * included), directives, anchors and aliases, and non-core tags are issues, and then the value is
 * not used. `lineOffset` places frontmatter lines in their MDX file.
 */
function parseYaml(loader: Loader, file: string, text: string, lineOffset = 0): Parsed {
  const lineCounter = new LineCounter()
  const doc = parseDocument(text, {
    version: '1.2',
    schema: 'core',
    uniqueKeys: true,
    prettyErrors: true,
    lineCounter,
  })
  const issues: ContentIssue[] = []
  const at = (offset: number) => {
    const { line, col } = lineCounter.linePos(offset)
    return { line: line + lineOffset, column: col }
  }

  const directive = directiveLine(text)
  if (directive !== null) {
    issues.push({ file, line: directive + lineOffset, column: 1, message: DIRECTIVES })
  }
  for (const error of [...doc.errors, ...doc.warnings]) {
    // An unknown directive is already the issue above.
    if (directive !== null && error.code === 'BAD_DIRECTIVE') continue
    const start = error.linePos?.[0]
    // prettyErrors appends " at line L, column C:" and a source excerpt to the message.
    const message = (error.message.split('\n')[0] ?? '').replace(/ at line \d+, column \d+:$/, '')
    issues.push({
      file,
      ...(start === undefined ? {} : { line: start.line + lineOffset, column: start.col }),
      message,
    })
  }
  let anchored = false
  visit(doc, {
    Node(_key, node) {
      const offset = node.range?.[0] ?? 0
      if (!anchored && (isAlias(node) || node.anchor !== undefined)) {
        anchored = true
        issues.push({ file, ...at(offset), message: ANCHORS })
      }
      if (node.tag !== undefined && !CORE_TAGS.has(node.tag)) {
        issues.push({
          file,
          ...at(offset),
          message: `the YAML tag ${node.tag} is not allowed (core tags only)`,
        })
      }
    },
  })

  loader.issues.push(...issues)
  return issues.length === 0 ? { ok: true, value: doc.toJS() } : { ok: false }
}

/** Read a YAML file: a leading BOM, the YAML itself, then NFC of every string ([RF-3]). */
function readYaml(loader: Loader, abs: string): Parsed {
  const file = labelOf(loader, abs)
  const text = readText(loader, abs)
  if (text === null) return { ok: false }
  const bom = bomIssue(file, text)
  if (bom !== null) loader.issues.push(bom)
  const parsed = parseYaml(loader, file, text.replace(/^\uFEFF/, ''))
  if (parsed.ok) loader.issues.push(...nfcIssues(file, parsed.value))
  return parsed
}

/** Validate against a schema; issues carry their dotted path. */
function validate<T>(loader: Loader, file: string, schema: z.ZodType<T>, value: unknown): T | null {
  const result = schema.safeParse(value)
  if (result.success) return result.data
  for (const issue of result.error.issues) {
    loader.issues.push({ file, path: issue.path.map(String).join('.'), message: issue.message })
  }
  return null
}

function loadYaml<T>(loader: Loader, abs: string, schema: z.ZodType<T>): T | null {
  const parsed = readYaml(loader, abs)
  return parsed.ok ? validate(loader, labelOf(loader, abs), schema, parsed.value) : null
}

// -----------------------------------------------------------------------------------------------
// IDs (decision 9)
// -----------------------------------------------------------------------------------------------

/**
 * The ID rules a schema cannot see: an item's track is its folder's track, and — when the file or
 * folder names the item — the ID is exactly `expected`. Reported at `idPath`; true when valid.
 */
function checkId(
  loader: Loader,
  track: Track,
  file: string,
  idPath: string,
  id: string,
  expected: { id: string; because: string } | null,
): boolean {
  const trackId = parseItemId(id)?.trackId
  if (trackId !== undefined && trackId !== track.id) {
    loader.issues.push({
      file,
      path: idPath,
      message: `"${id}" is an ID of track ${trackId} — IDs in ${labelOf(loader, track.dir)}/ start "${track.id}:"`,
    })
    return false
  }
  if (expected !== null && id !== expected.id) {
    loader.issues.push({
      file,
      path: idPath,
      message: `must be "${expected.id}" to match ${expected.because}`,
    })
    return false
  }
  return true
}

/** A file of an item type the manifest does not list is an issue (once per file). */
function checkListed(loader: Loader, track: Track, abs: string, type: ItemType): void {
  if (track.manifest !== null && !track.manifest.itemTypes.includes(type)) {
    const manifest = labelOf(loader, path.join(track.dir, 'track.yaml'))
    report(loader, abs, `the track does not list ${type} in itemTypes (${manifest})`)
  }
}

type ItemFields<K extends ItemType> = Omit<CatalogItem<K>, 'trackId' | 'localId'>

function addItem<K extends ItemType>(loader: Loader, fields: ItemFields<K>, idPath?: string) {
  const parsed = parseItemId(fields.id)
  if (parsed === null) return
  const item = { ...fields, trackId: parsed.trackId, localId: parsed.localId } as CatalogItem
  loader.items.push({ item, idPath })
}

// -----------------------------------------------------------------------------------------------
// MDX (§3.6 step 3)
// -----------------------------------------------------------------------------------------------

type MdxSource = { file: string; tree: MdxRoot; frontmatter: { text: string; line: number } | null }

/** Read and parse an MDX file: BOM, NFC and syntax issues are reported; null when it cannot parse. */
async function readMdx(loader: Loader, abs: string): Promise<MdxSource | null> {
  const file = labelOf(loader, abs)
  const source = readText(loader, abs)
  if (source === null) return null
  for (const issue of [bomIssue(file, source), nfcSourceIssue(file, source)]) {
    if (issue !== null) loader.issues.push(issue)
  }
  // The BOM is reported above (the MDX parser itself skips it).
  const parsed = await parseMdx(file, source)
  if (!parsed.ok) {
    loader.issues.push(parsed.issue)
    return null
  }
  const first = parsed.tree.children[0]
  const frontmatter =
    first?.type === 'yaml'
      ? { text: first.value ?? '', line: first.position?.start.line ?? 1 }
      : null
  return { file, tree: parsed.tree, frontmatter }
}

/** Frontmatter YAML, positioned in its file (its first line follows the opening `---`). */
function parseFrontmatter(loader: Loader, mdx: MdxSource): Parsed {
  if (mdx.frontmatter === null) return { ok: true, value: undefined }
  return parseYaml(loader, mdx.file, mdx.frontmatter.text, mdx.frontmatter.line)
}

/**
 * The safety check and facts, for an item whose ID passed validation: the image prefix
 * `<trackId>/<localId>/` (OD3) is built only from a valid ID.
 */
function checkMdxFile(
  loader: Loader,
  mdx: MdxSource,
  abs: string,
  itemId: string,
  key: string,
  context: MdxContext,
): MdxFacts {
  const id = parseItemId(itemId)
  if (id === null) throw new Error(`content:build: MDX checked for an invalid item ID ${itemId}`)
  loader.issues.push(
    ...checkMdx(mdx.file, mdx.tree, context, { imagePathPrefix: `${id.trackId}/${id.localId}/` }),
  )
  const facts = mdxFacts(mdx.tree)
  loader.mdx.push({ key, itemId, file: mdx.file, absPath: abs, context, facts })
  return facts
}

// -----------------------------------------------------------------------------------------------
// Item files
// -----------------------------------------------------------------------------------------------

const lessonIdSchema = prefixedItemIdSchema(LOCAL_ID_PREFIX.lesson)

async function loadLesson(loader: Loader, track: Track, abs: string, base: string): Promise<void> {
  checkListed(loader, track, abs, 'lesson')
  const mdx = await readMdx(loader, abs)
  if (mdx === null) return
  if (mdx.frontmatter === null) {
    report(loader, abs, 'a lesson starts with YAML frontmatter (`---`)', { line: 1, column: 1 })
    return
  }
  const parsed = parseFrontmatter(loader, mdx)
  if (!parsed.ok) return

  const expected = `${track.id}:${LOCAL_ID_PREFIX.lesson}${base}`
  const rawId = (parsed.value as { id?: unknown } | null)?.id
  const frontmatter = validate(loader, mdx.file, lessonFrontmatterSchema, parsed.value)
  // A malformed ID is the schema's issue; a well-formed one must be this track's and this file's.
  // Only then is the image prefix built from it (checkMdx throws on a malformed prefix).
  const idValid =
    typeof rawId === 'string' &&
    lessonIdSchema.safeParse(rawId).success &&
    checkId(loader, track, mdx.file, 'id', rawId, {
      id: expected,
      because: `the file name ${base}.mdx`,
    })
  if (!idValid) return

  const facts = checkMdxFile(loader, mdx, abs, expected, expected, 'lesson')
  if (frontmatter === null) return
  addItem<'lesson'>(loader, {
    id: frontmatter.id,
    type: 'lesson',
    topicId: frontmatter.topic,
    week: null,
    status: frontmatter.status,
    title: frontmatter.title,
    source: mdx.file,
    content: {
      ...frontmatter,
      mdxKey: frontmatter.id,
      sections: facts.sections.map((section) => section.kind),
    },
  })
}

async function loadProblem(loader: Loader, track: Track, dir: string, name: string): Promise<void> {
  const folder = parseProblemFolder(name)
  if (folder === null) return report(loader, dir, PROBLEM_FOLDER_RULE)

  const files = new Set<string>()
  for (const entry of scan(loader, dir)) {
    const abs = path.join(dir, entry.name)
    if (entry.isFile() && PROBLEM_FILES.has(entry.name)) files.add(entry.name)
    else unexpected(loader, abs, entry, PROBLEM_RULE)
  }
  const problemAbs = path.join(dir, 'problem.yaml')
  if (!files.has('problem.yaml')) {
    return report(loader, problemAbs, 'missing — every problem folder needs problem.yaml')
  }
  checkListed(loader, track, problemAbs, 'problem')

  const file = labelOf(loader, problemAbs)
  const problem = loadYaml(loader, problemAbs, problemSchema)
  const tests = files.has('tests.yaml')
    ? loadYaml(loader, path.join(dir, 'tests.yaml'), testsFileSchema)
    : null
  if (problem === null) return
  const expected = `${track.id}:${problemLocalId(folder.leetcode)}`
  if (
    !checkId(loader, track, file, 'id', problem.id, { id: expected, because: `the folder ${name}` })
  ) {
    return
  }

  const solutions: ProblemFiles['solutions'] = {}
  for (const language of CODE_LANGUAGES) {
    const solutionAbs = path.join(dir, SOLUTION_FILES[language])
    const source = files.has(SOLUTION_FILES[language]) ? readText(loader, solutionAbs) : null
    if (source !== null) solutions[language] = { file: labelOf(loader, solutionAbs), source }
  }
  loader.problemFiles.set(problem.id, { solutions, tests })

  const note = files.has('note.mdx')
    ? await loadNote(loader, path.join(dir, 'note.mdx'), problem.id, solutions, tests)
    : null
  const content: ProblemContent = {
    ...problem,
    slug: folder.slug,
    url: `https://leetcode.com/problems/${folder.slug}/`,
    note,
  }
  addItem<'problem'>(loader, {
    id: problem.id,
    type: 'problem',
    topicId: problem.topic,
    week: null,
    status: problem.status,
    title: problem.title,
    source: file,
    content,
  })
}

async function loadNote(
  loader: Loader,
  abs: string,
  problemId: string,
  solutions: ProblemFiles['solutions'],
  tests: TestsFile | null,
): Promise<ProblemNote | null> {
  const mdx = await readMdx(loader, abs)
  if (mdx === null) return null
  const key = `${problemId}#note`
  const facts = checkMdxFile(loader, mdx, abs, problemId, key, 'note')
  const parsed = parseFrontmatter(loader, mdx)
  if (!parsed.ok) return null
  const frontmatter = validate(loader, mdx.file, noteFrontmatterSchema, parsed.value ?? {})
  // A note comes with tests.yaml (§3.6): without one it has no verification, so it is checked but
  // not built — content:build's cross-references report the missing file.
  if (frontmatter === null || tests === null) return null
  return {
    status: frontmatter.status,
    mdxKey: key,
    verification: verificationFor(tests.signature.kind),
    languages: CODE_LANGUAGES.filter((language) => solutions[language] !== undefined),
    // The safety check requires exactly one of each in a note (a missing one fails the build).
    bilingual: facts.bilingual[0] ?? { vi: '', en: '' },
    complexity: facts.complexity[0] ?? { time: '', space: '' },
    // content:build fills it from the deep-dive lessons (crossref.ts `deepDiveIndex`).
    deepDiveId: null,
  }
}

const STATUS_RANK: { readonly [K in ItemStatus]: number } = { active: 0, draft: 1, retired: 2 }
/** The stricter of two statuses: a card of a draft deck is a draft, of a retired deck retired. */
const stricter = (a: ItemStatus, b: ItemStatus): ItemStatus =>
  STATUS_RANK[a] >= STATUS_RANK[b] ? a : b

function loadDeck(loader: Loader, track: Track, abs: string, base: string): void {
  checkListed(loader, track, abs, 'flashcard')
  const file = labelOf(loader, abs)
  const deck: DeckFile | null = loadYaml(loader, abs, deckFileSchema)
  if (deck === null) return
  const expected = `${track.id}:${LOCAL_ID_PREFIX.deck}${base}`
  if (
    !checkId(loader, track, file, 'id', deck.id, {
      id: expected,
      because: `the file name ${base}.yaml`,
    })
  ) {
    return
  }

  const cardIds: string[] = []
  deck.cards.forEach((card, index) => {
    const idPath = `cards.${index}.id`
    if (!checkId(loader, track, file, idPath, card.id, null)) return
    cardIds.push(card.id)
    addItem<'flashcard'>(
      loader,
      {
        id: card.id,
        type: 'flashcard',
        topicId: deck.topic,
        week: deck.week,
        status: stricter(card.status, deck.status),
        title: card.front,
        source: file,
        content: {
          ...card,
          deckId: deck.id,
          lang: { ...deck.lang, hint: deck.lang.back },
          derivedFrom: null,
        },
      },
      idPath,
    )
  })
  loader.decks.push({
    id: deck.id,
    trackId: track.id,
    kind: deck.kind,
    week: deck.week,
    topicId: deck.topic,
    title: deck.title,
    status: deck.status,
    cardIds,
  })
}

function loadExercises(loader: Loader, track: Track, abs: string): void {
  checkListed(loader, track, abs, 'exercise')
  const file = labelOf(loader, abs)
  const exercises = loadYaml(loader, abs, exercisesFileSchema) ?? []
  exercises.forEach((exercise, index) => {
    const idPath = `${index}.id`
    if (!checkId(loader, track, file, idPath, exercise.id, null)) return
    addItem<'exercise'>(
      loader,
      {
        id: exercise.id,
        type: 'exercise',
        topicId: exercise.topic,
        week: exercise.week,
        status: exercise.status,
        title: exercise.instruction.vi,
        source: file,
        content: exercise,
      },
      idPath,
    )
  })
}

function loadPrompts(loader: Loader, track: Track, abs: string): void {
  checkListed(loader, track, abs, 'prompt')
  const file = labelOf(loader, abs)
  const prompts = loadYaml(loader, abs, promptsFileSchema) ?? []
  prompts.forEach((prompt, index) => {
    const idPath = `${index}.id`
    if (!checkId(loader, track, file, idPath, prompt.id, null)) return
    addItem<'prompt'>(
      loader,
      {
        id: prompt.id,
        type: 'prompt',
        topicId: null,
        week: prompt.week ?? null,
        status: prompt.status,
        title: prompt.instruction.vi,
        source: file,
        content: prompt,
      },
      idPath,
    )
  })
}

function loadRoadmap(loader: Loader, track: Track, abs: string, base: string): void {
  const roadmap = loadYaml(loader, abs, roadmapSchema)
  if (roadmap !== null) {
    loader.roadmapFiles.push({
      trackId: track.id,
      variant: base,
      file: labelOf(loader, abs),
      roadmap,
    })
  }
}

// -----------------------------------------------------------------------------------------------
// Folders
// -----------------------------------------------------------------------------------------------

/** The files of a one-kind folder (lessons/, decks/, …), each checked for its name. */
function folderFiles(
  loader: Loader,
  dir: string,
  folder: FileFolder,
): { abs: string; base: string }[] {
  const files: { abs: string; base: string }[] = []
  const name = path.basename(dir)
  for (const entry of scan(loader, dir)) {
    const abs = path.join(dir, entry.name)
    if (!entry.isFile() || !entry.name.endsWith(folder.extension)) {
      unexpected(loader, abs, entry, `${name}/ holds only ${folder.extension} files`)
      continue
    }
    const base = entry.name.slice(0, -folder.extension.length)
    if (folder.valid(base)) files.push({ abs, base })
    else report(loader, abs, folder.rule)
  }
  return files
}

async function loadTrack(loader: Loader, dir: string, id: string): Promise<void> {
  const folders = new Map<string, string>()
  let hasManifest = false
  for (const entry of scan(loader, dir)) {
    const abs = path.join(dir, entry.name)
    if (entry.isFile() && entry.name === 'track.yaml') hasManifest = true
    else if (entry.isDirectory() && TRACK_FOLDERS.has(entry.name)) folders.set(entry.name, abs)
    else unexpected(loader, abs, entry, TRACK_RULE)
  }

  const manifestAbs = path.join(dir, 'track.yaml')
  let manifest: TrackManifest | null = null
  if (!hasManifest) report(loader, manifestAbs, 'missing — every track folder needs track.yaml')
  else manifest = loadYaml(loader, manifestAbs, trackManifestSchema)
  if (manifest !== null && manifest.id !== id) {
    report(loader, manifestAbs, `"${manifest.id}" must equal the folder name "${id}"`, {
      path: 'id',
    })
  } else if (manifest !== null) {
    loader.tracks.push(manifest)
    loader.manifestFiles.set(manifest.id, labelOf(loader, manifestAbs))
  }
  const track: Track = { id, dir, manifest }

  // Sorted by folder name, so issues and duplicates are found in a stable order.
  for (const [name, folderDir] of [...folders].sort(([a], [b]) => compareNames(a, b))) {
    if (name === 'problems') {
      for (const entry of scan(loader, folderDir)) {
        const abs = path.join(folderDir, entry.name)
        if (entry.isDirectory()) await loadProblem(loader, track, abs, entry.name)
        else unexpected(loader, abs, entry, 'problems/ holds only problem folders')
      }
      continue
    }
    const kind = name as keyof typeof FOLDERS
    for (const { abs, base } of folderFiles(loader, folderDir, FOLDERS[kind])) {
      if (kind === 'lessons') await loadLesson(loader, track, abs, base)
      else if (kind === 'decks') loadDeck(loader, track, abs, base)
      else if (kind === 'exercises') loadExercises(loader, track, abs)
      else if (kind === 'prompts') loadPrompts(loader, track, abs)
      else loadRoadmap(loader, track, abs, base)
    }
  }
}

const isTrackFolder = (name: string): boolean =>
  TRACK_ID_PATTERN.test(name) && name !== RESERVED_TRACK_ID

async function loadTracks(loader: Loader, dir: string): Promise<void> {
  for (const entry of scan(loader, dir)) {
    const abs = path.join(dir, entry.name)
    if (!entry.isDirectory()) unexpected(loader, abs, entry, TRACKS_RULE)
    else if (!isTrackFolder(entry.name)) report(loader, abs, TRACK_FOLDER_RULE)
    else await loadTrack(loader, abs, entry.name)
  }
}

/** IDs are unique across all tracks: a repeat is reported at its later file and dropped. */
function uniqueItems(loader: Loader): CatalogItem[] {
  const first = new Map<string, string>()
  const items: CatalogItem[] = []
  for (const { item, idPath } of loader.items) {
    const seen = first.get(item.id)
    if (seen === undefined) {
      first.set(item.id, item.source)
      items.push(item)
    } else {
      loader.issues.push({
        file: item.source,
        ...(idPath === undefined ? {} : { path: idPath }),
        message: `duplicate ID ${item.id} — also in ${seen}`,
      })
    }
  }
  return items
}

/** Load and check everything under `contentDir`; file names are relative to `repoRoot`. */
export async function loadContent({ repoRoot, contentDir }: LoadOptions): Promise<LoadedContent> {
  const loader: Loader = {
    repoRoot,
    issues: [],
    tracks: [],
    manifestFiles: new Map(),
    roadmapFiles: [],
    items: [],
    decks: [],
    mdx: [],
    problemFiles: new Map(),
  }

  let hasTracks = false
  for (const entry of scan(loader, contentDir)) {
    const abs = path.join(contentDir, entry.name)
    if (entry.isFile() && (entry.name === 'LICENSE' || entry.name === 'ids.lock')) continue
    if (entry.isDirectory() && entry.name === 'tracks') {
      hasTracks = true
      await loadTracks(loader, abs)
    } else {
      unexpected(loader, abs, entry, ROOT_RULE)
    }
  }
  if (!hasTracks) {
    report(
      loader,
      path.join(contentDir, 'tracks'),
      `missing — ${ROOT_RULE}, and tracks/ is required`,
    )
  }

  const items = uniqueItems(loader)
  return {
    tracks: [...loader.tracks].sort((a, b) => compareNames(a.id, b.id)),
    manifestFiles: loader.manifestFiles,
    roadmapFiles: loader.roadmapFiles,
    items,
    decks: loader.decks,
    mdx: [...loader.mdx].sort((a, b) => compareNames(a.key, b.key)),
    problemFiles: loader.problemFiles,
    issues: sortIssues(loader.issues),
  }
}
