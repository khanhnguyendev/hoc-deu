/**
 * `content/ids.lock` (platform design §3.3, decision 8, ADR-0010): every published item ID,
 * derived ones included. IDs are append-only — events reference them forever — so an ID may leave
 * `content/**` only after it is moved from `[published]` to `[retired]` by hand, and a retired ID
 * is never reused.
 */
import { parseDerivedId, parseItemId } from '@/lib/content/schemas/ids'
import type { ContentIssue } from './issues'

export type IdsLock = { published: string[]; retired: string[] }

export type LockDiff = {
  /** In content, in neither section: added by a local run, an issue in check mode. */
  added: string[]
  /** In `[published]`, not in content and not retired. */
  removed: string[]
  /** In `[retired]` and back in content. */
  reused: string[]
  /** In both sections. */
  inBoth: string[]
  /** The file is exactly `formatLock` of what it holds (sorted, unique, the header). */
  normalized: boolean
}

export const LOCK_FILE = 'content/ids.lock'

const HEADER = [
  '# content/ids.lock — every published content ID (platform design §3.3, ADR-0010).',
  '# IDs are append-only: events reference them forever. `pnpm content:build` adds new IDs.',
  '# An ID may leave content/** only after you move it from [published] to [retired] by hand.',
]

const SECTIONS = { '[published]': 'published', '[retired]': 'retired' } as const

const isContentId = (id: string): boolean => parseItemId(id) !== null || parseDerivedId(id) !== null

const sortedUnique = (ids: Iterable<string>): string[] =>
  [...new Set(ids)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))

/** The lock in a file's text; a missing file is ''. Issues name their line. */
export function parseLock(text: string): { lock: IdsLock; issues: string[] } {
  const lock: IdsLock = { published: [], retired: [] }
  const issues: string[] = []
  // null: before any section; 'unknown': inside an unknown section (its lines are not reported).
  let section: keyof IdsLock | 'unknown' | null = null

  text.split('\n').forEach((raw, index) => {
    const line = raw.trim()
    const at = `line ${index + 1}`
    if (line === '' || line.startsWith('#')) return
    if (Object.hasOwn(SECTIONS, line)) {
      section = SECTIONS[line as keyof typeof SECTIONS]
    } else if (line.startsWith('[') && line.endsWith(']')) {
      issues.push(`${at}: unknown section ${line} (expected [published] or [retired])`)
      section = 'unknown'
    } else if (section === null) {
      issues.push(`${at}: ${line} is outside the [published] and [retired] sections`)
    } else if (section !== 'unknown') {
      if (isContentId(line)) lock[section].push(line)
      else issues.push(`${at}: "${line}" is not a content ID`)
    }
  })
  return { lock, issues }
}

/** The header, then each section sorted and unique, one ID per line. */
export function formatLock(lock: IdsLock): string {
  const lines = [
    ...HEADER,
    '',
    '[published]',
    ...sortedUnique(lock.published),
    '',
    '[retired]',
    ...sortedUnique(lock.retired),
  ]
  return `${lines.join('\n')}\n`
}

/** Compare the lock with the IDs in content (item and derived IDs). */
export function diffLock(lock: IdsLock, contentIds: readonly string[], fileText: string): LockDiff {
  const published = new Set(lock.published)
  const retired = new Set(lock.retired)
  const content = new Set(contentIds)
  return {
    added: sortedUnique(contentIds.filter((id) => !published.has(id) && !retired.has(id))),
    removed: sortedUnique(lock.published.filter((id) => !content.has(id) && !retired.has(id))),
    reused: sortedUnique(lock.retired.filter((id) => content.has(id))),
    inBoth: sortedUnique(lock.published.filter((id) => retired.has(id))),
    normalized: formatLock(lock) === fileText,
  }
}

/**
 * Removed, reused and double-listed IDs are issues in both modes; in check mode (CI, Vercel) a
 * stale file is one too — a local run rewrites it instead.
 */
export function lockIssues(
  diff: LockDiff,
  check: boolean,
  file: string = LOCK_FILE,
): ContentIssue[] {
  const issue = (message: string): ContentIssue => ({ file, message })
  const issues = [
    ...diff.removed.map((id) =>
      issue(
        `\`${id}\` is in ${LOCK_FILE} but no longer in content/** — restore it, set \`status: retired\`, or move it to [retired] (IDs are append-only, ADR-0010)`,
      ),
    ),
    ...diff.reused.map((id) => issue(`\`${id}\` is retired in ${LOCK_FILE} and cannot be reused`)),
    ...diff.inBoth.map((id) =>
      issue(`\`${id}\` is in both [published] and [retired] in ${LOCK_FILE}`),
    ),
  ]
  if (check && diff.added.length > 0) {
    const count = diff.added.length
    issues.push(
      issue(
        `${LOCK_FILE} is missing ${count} ID${count === 1 ? '' : 's'} — run \`pnpm content:build\` and commit ${LOCK_FILE}`,
      ),
    )
  }
  if (check && !diff.normalized) {
    issues.push(issue(`${LOCK_FILE} is not normalised — run \`pnpm content:build\``))
  }
  return issues
}
