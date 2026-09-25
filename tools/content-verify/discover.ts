/**
 * Finds what `content:verify` checks (platform design §3.7): every
 * `<tracks root>/<track>/problems/<folder>/tests.yaml`, validated, with the solution languages
 * whose files exist. Reads only; never writes into `content/`.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { parse as parseYaml } from 'yaml'
import { CODE_LANGUAGES, type CodeLanguage } from '@/lib/content/schemas/common'
import { parseProblemFolder, problemLocalId } from '@/lib/content/schemas/ids'
import { testsFileSchema, type TestsFile } from '@/lib/content/schemas/tests'

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

function listDirs(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}

function label(file: string): string {
  return relative(process.cwd(), file).split(sep).join('/')
}

function readTests(file: string): { tests: TestsFile } | { issue: string } {
  let data: unknown
  try {
    data = parseYaml(readFileSync(file, 'utf8'))
  } catch (error) {
    const message = error instanceof Error ? error.message.split('\n')[0] : String(error)
    return { issue: `${label(file)}: ${message}` }
  }
  const result = testsFileSchema.safeParse(data)
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

  for (const track of listDirs(tracksRoot)) {
    const problemsDir = join(tracksRoot, track, 'problems')
    for (const folder of listDirs(problemsDir)) {
      const dir = join(problemsDir, folder)
      const testsFile = join(dir, 'tests.yaml')
      if (!existsSync(testsFile)) continue

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
      const present = CODE_LANGUAGES.filter((lang) => existsSync(join(dir, SOLUTION_FILES[lang])))
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
