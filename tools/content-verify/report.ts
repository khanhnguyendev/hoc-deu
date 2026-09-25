/**
 * The `content:verify` report (platform design §3.7): a header naming the toolchains, one row per
 * problem, and the counts as the last line — the line CI surfaces (`tested 27 · compile-only 3`).
 */
import type { SignatureKind } from '@/lib/content/schemas/tests'
import type { LanguageResult, ProblemResult } from './orchestrator'

/** The milestone whose harness runs each kind the current one only compiles (§3.7 phases). */
const PHASE: Readonly<Record<SignatureKind, string>> = {
  function: 'M3a',
  'linked-list': 'M3b',
  tree: 'M3b',
  'graph-node': 'M3b',
  'random-list': 'M3b',
  'design-class': 'M3c',
}

const STATUS_WIDTH = 'compile-only'.length
/** Wide enough for `python 10/10 · java 10/10 · go 9/9`, so the times line up. */
const COUNTS_WIDTH = 35

const seconds = (ms: number): string => `${(ms / 1000).toFixed(1)} s`

/** The first informative line (Go prints a `# <package>` header before its errors). */
function firstLine(text: string | undefined): string {
  const lines = (text ?? '').split('\n').filter((line) => line.trim() !== '')
  return lines.find((line) => !line.startsWith('# ')) ?? lines[0] ?? ''
}

function languageFailure(language: LanguageResult): string | null {
  if (language.status !== 'failed') return null
  const failing = language.cases.filter((testCase) => testCase.status !== 'pass')
  const [first] = failing
  if (first === undefined) return `${language.lang}: ${firstLine(language.detail)}`
  const more = failing.length > 1 ? ` (+${failing.length - 1} more)` : ''
  return `${language.lang}: case '${first.name}' ${firstLine(first.detail)} (${seconds(first.ms)})${more}`
}

function rowDetails(result: ProblemResult): { label: string; details: string } {
  if (!result.ok) {
    const failures = result.languages.flatMap((language) => languageFailure(language) ?? [])
    return { label: 'FAILED', details: failures.join(' · ') }
  }
  if (result.verification === 'compile-only') {
    const checks = result.languages.map((language) => `${language.lang} ✓`).join(' · ')
    return {
      label: 'compile-only',
      details: `${checks}  (${result.kind} runs in ${PHASE[result.kind]})`,
    }
  }
  const counts = result.languages
    .map((language) => {
      const passed = language.cases.filter((testCase) => testCase.status === 'pass').length
      return `${language.lang} ${passed}/${language.cases.length}`
    })
    .join(' · ')
  const ms = result.languages
    .flatMap((language) => language.cases)
    .reduce((total, testCase) => total + testCase.ms, 0)
  return { label: 'tested', details: `${counts.padEnd(COUNTS_WIDTH)}  ${seconds(ms)}` }
}

/**
 * `toolchains` completes the header (`python 3.13.7 · javac 23.0.2 · go 1.26.5 · 1 job (sandbox
 * cvsandbox)`); `issues` are discovery errors (an invalid `tests.yaml`), listed before the counts.
 */
export function formatReport(
  results: readonly ProblemResult[],
  toolchains: string,
  issues: readonly string[] = [],
): string {
  const idWidth = Math.max(0, ...results.map((result) => result.id.length))
  const lines = [`content:verify · ${toolchains}`]
  for (const result of results) {
    const { label, details } = rowDetails(result)
    lines.push(`  ${result.id.padEnd(idWidth)}  ${label.padEnd(STATUS_WIDTH)}  ${details}`)
  }
  for (const issue of issues) lines.push(`  error  ${issue}`)

  const count = (predicate: (result: ProblemResult) => boolean): number =>
    results.filter(predicate).length
  const summary = [
    `tested ${count((result) => result.ok && result.verification === 'tested')}`,
    `compile-only ${count((result) => result.ok && result.verification === 'compile-only')}`,
    `failed ${count((result) => !result.ok)}`,
    ...(issues.length > 0 ? [`errors ${issues.length}`] : []),
  ]
  lines.push(summary.join(' · '))
  return lines.join('\n')
}
