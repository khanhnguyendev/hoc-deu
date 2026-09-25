/**
 * Finds what `content:verify` checks (platform design §3.7): every
 * `<tracks root>/<track>/problems/<folder>/tests.yaml`, validated, with the solution languages
 * whose files exist. Reads only; never writes into `content/`, and never reads through a symlink
 * (the runner would copy whatever it points at to where a solution can print it): a symlinked
 * directory or file is an issue.
 */
import { existsSync, lstatSync, readdirSync, readFileSync, type Stats } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { CODE_LANGUAGES, type CodeLanguage } from '@/lib/content/schemas/common'
import { parseProblemFolder, problemLocalId } from '@/lib/content/schemas/ids'
import { testsFileSchema, type TestsFile } from '@/lib/content/schemas/tests'
import { parseContentYaml, type YamlIssue } from '../content/yaml'

export type ProblemUnderTest = {
  /** `dsa:lc-0001` */
  id: string
  /** The problem folder (absolute). */
  dir: string
  tests: TestsFile
  languages: CodeLanguage[]
}

export const SOLUTION_FILES: Readonly<Record<CodeLanguage, string>> = {
  python: 'solution.py',
  java: 'Solution.java',
  go: 'solution.go',
}

const MAX_SCHEMA_ISSUES = 5

function label(file: string): string {
  return relative(process.cwd(), file).split(sep).join('/')
}

/** `lstat`, or `null` when nothing is there. */
function entryAt(path: string): Stats | null {
  try {
    return lstatSync(path)
  } catch {
    return null
  }
}

/** The sub-directories of `dir`, sorted; symlinked entries become issues. */
function listDirs(dir: string, issues: string[]): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => {
      if (entry.isSymbolicLink()) {
        issues.push(
          `${label(join(dir, entry.name))}: not a regular directory (a symlink?); never followed`,
        )
      }
      return entry.isDirectory()
    })
    .map((entry) => entry.name)
    .sort()
}

type FileState = 'absent' | 'file' | 'other'
function fileState(path: string): FileState {
  const stat = entryAt(path)
  if (stat === null) return 'absent'
  return stat.isFile() ? 'file' : 'other'
}
const notRegular = (path: string): string =>
  `${label(path)}: not a regular file (a symlink?); never followed`

/** `file:line:column: message`, as content:build prints a positioned issue. */
function yamlIssue(file: string, issue: YamlIssue): string {
  const position = issue.line === undefined ? '' : `:${issue.line}:${issue.column ?? 1}`
  return `${label(file)}${position}: ${issue.message}`
}

function readTests(file: string): { tests: TestsFile } | { issue: string } {
  // content:build's pinned parser (YAML 1.2 core; no directives, anchors or custom tags), so the
  // verdict and the catalog never read one file differently (final review M4).
  const parsed = parseContentYaml(readFileSync(file, 'utf8'))
  if (!parsed.ok) {
    return { issue: parsed.issues.map((issue) => yamlIssue(file, issue)).join('; ') }
  }
  const result = testsFileSchema.safeParse(parsed.value)
  if (result.success) return { tests: result.data }
  const messages = result.error.issues
    .slice(0, MAX_SCHEMA_ISSUES)
    .map((issue) => `${issue.path.length > 0 ? issue.path.join('.') : '(root)'}: ${issue.message}`)
  const more = result.error.issues.length - messages.length
  return { issue: `${label(file)}: ${messages.join('; ')}${more > 0 ? ` (+${more} more)` : ''}` }
}

/**
 * Every problem with a `tests.yaml` under `tracksRoot`, sorted by ID. `filter.ids` keeps only
 * those IDs (an unknown one is an issue); `filter.lang` keeps only that language (problems without
 * its solution file drop out). Invalid files are issues, never thrown.
 */
export function discoverProblems(
  tracksRoot: string,
  filter: { ids?: readonly string[]; lang?: CodeLanguage } = {},
): { problems: ProblemUnderTest[]; issues: string[] } {
  const problems: ProblemUnderTest[] = []
  const issues: string[] = []
  const wanted = filter.ids === undefined ? null : new Set(filter.ids)
  const found = new Set<string>()

  // The root is the CLI's own argument (trusted, may be a symlink); everything below it is content.
  if (!existsSync(tracksRoot)) return { problems, issues }
  for (const track of listDirs(tracksRoot, issues)) {
    const problemsDir = join(tracksRoot, track, 'problems')
    const problemsStat = entryAt(problemsDir)
    if (problemsStat === null) continue
    if (!problemsStat.isDirectory()) {
      issues.push(`${label(problemsDir)}: not a regular directory (a symlink?); never followed`)
      continue
    }
    for (const folder of listDirs(problemsDir, issues)) {
      const dir = join(problemsDir, folder)
      const testsFile = join(dir, 'tests.yaml')
      const testsState = fileState(testsFile)
      if (testsState === 'absent') continue
      if (testsState === 'other') {
        issues.push(notRegular(testsFile))
        continue
      }

      const parsed = parseProblemFolder(folder)
      if (parsed === null) {
        issues.push(`${label(dir)}: not a problem folder (lc-<number>-<slug>)`)
        continue
      }
      const id = `${track}:${problemLocalId(parsed.leetcode)}`
      if (wanted !== null && !wanted.has(id)) continue
      found.add(id)

      const read = readTests(testsFile)
      if ('issue' in read) {
        issues.push(read.issue)
        continue
      }
      const states = CODE_LANGUAGES.map((lang) => {
        const file = join(dir, SOLUTION_FILES[lang])
        return { lang, file, state: fileState(file) }
      })
      const odd = states.filter((entry) => entry.state === 'other')
      if (odd.length > 0) {
        for (const entry of odd) issues.push(notRegular(entry.file))
        continue
      }
      const present = states.filter((entry) => entry.state === 'file').map((entry) => entry.lang)
      if (present.length === 0) {
        issues.push(`${label(dir)}: tests.yaml without a solution file`)
        continue
      }
      const languages =
        filter.lang === undefined ? present : present.filter((l) => l === filter.lang)
      if (languages.length === 0) continue
      problems.push({ id, dir, tests: read.tests, languages })
    }
  }

  for (const id of filter.ids ?? []) {
    if (!found.has(id)) issues.push(`--problem ${id}: no such problem with a tests.yaml`)
  }
  problems.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  return { problems, issues }
}
