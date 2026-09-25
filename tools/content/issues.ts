import { compareNames } from './util'

/**
 * One problem found in a content file: an MDX position (`line`/`column`) or a YAML `path`
 * (`cards.3.front`), or neither for a file-level problem.
 */
export type ContentIssue = {
  file: string
  line?: number
  column?: number
  path?: string
  message: string
}

/** `file:12:3: message` for a position, `file: cards.3.front: message` for a YAML path. */
export function formatIssue(issue: ContentIssue): string {
  let location = issue.file
  if (issue.line !== undefined) {
    location += `:${issue.line}`
    if (issue.column !== undefined) location += `:${issue.column}`
  }
  const path = issue.path !== undefined && issue.path !== '' ? ` ${issue.path}:` : ''
  return `${location}:${path} ${issue.message}`
}

/** Missing values first, then ascending. */
function compareOptional<T>(a: T | undefined, b: T | undefined, compare: (a: T, b: T) => number) {
  if (a === undefined || b === undefined) return a === b ? 0 : a === undefined ? -1 : 1
  return compare(a, b)
}

/** Dotted paths segment by segment, numeric segments as numbers (`cards.3` before `cards.10`). */
function comparePath(a: string, b: string): number {
  const left = a.split('.')
  const right = b.split('.')
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    const x = left[index] ?? ''
    const y = right[index] ?? ''
    const numeric = /^\d+$/.test(x) && /^\d+$/.test(y)
    const order = numeric ? Number(x) - Number(y) : compareNames(x, y)
    if (order !== 0) return order
  }
  return left.length - right.length
}

/** A sorted copy: by file, line, column, path, then message, so reports are stable. */
export function sortIssues(issues: readonly ContentIssue[]): ContentIssue[] {
  return [...issues].sort(
    (a, b) =>
      compareNames(a.file, b.file) ||
      compareOptional(a.line, b.line, (x, y) => x - y) ||
      compareOptional(a.column, b.column, (x, y) => x - y) ||
      compareOptional(a.path, b.path, comparePath) ||
      compareNames(a.message, b.message),
  )
}
