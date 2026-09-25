import { describe, expect, it } from 'vitest'
import { diffLock, formatLock, lockIssues, parseLock, type IdsLock } from './ids-lock'

const HEADER = [
  '# content/ids.lock — every published content ID (platform design §3.3, ADR-0010).',
  '# IDs are append-only: events reference them forever. `pnpm content:build` adds new IDs.',
  '# An ID may leave content/** only after you move it from [published] to [retired] by hand.',
].join('\n')

const lockText = (published: string[], retired: string[] = []): string =>
  [HEADER, '', '[published]', ...published, '', '[retired]', ...retired, ''].join('\n')

const EMPTY: IdsLock = { published: [], retired: [] }

/** What a local run writes: the lock plus the added IDs. */
const updated = (lock: IdsLock, added: readonly string[]): string =>
  formatLock({ published: [...lock.published, ...added], retired: lock.retired })

describe('parseLock and formatLock', () => {
  it('reads a missing file (empty text) as an empty lock', () => {
    expect(parseLock('')).toEqual({ lock: EMPTY, issues: [] })
  })

  it('formats the header and both sections, each sorted and unique', () => {
    expect(
      formatLock({ published: ['dsa:lc-0002', 'dsa:lc-0001', 'dsa:lc-0001'], retired: [] }),
    ).toBe(lockText(['dsa:lc-0001', 'dsa:lc-0002']))
  })

  it('formats an empty lock as the header with two empty sections (the committed file)', () => {
    expect(formatLock(EMPTY)).toBe(`${HEADER}\n\n[published]\n\n[retired]\n`)
  })

  it('round-trips', () => {
    const lock = { published: ['dsa:lc-0001', 'english:w01-blocker'], retired: ['dsa:lc-0002'] }
    const text = formatLock(lock)
    expect(parseLock(text)).toEqual({ lock, issues: [] })
    expect(formatLock(parseLock(text).lock)).toBe(text)
  })

  it('reports lines outside a section, unknown sections and malformed IDs, with their line', () => {
    const text = ['dsa:lc-0001', '[drafts]', 'dsa:lc-0003', '[published]', 'Not An ID'].join('\n')
    const { lock, issues } = parseLock(text)
    expect(lock).toEqual(EMPTY)
    expect(issues).toEqual([
      'line 1: dsa:lc-0001 is outside the [published] and [retired] sections',
      'line 2: unknown section [drafts] (expected [published] or [retired])',
      'line 5: "Not An ID" is not a content ID',
    ])
  })
})

describe('diffLock and lockIssues', () => {
  it('local run: two new IDs are added, sorted, with no issue; the rewritten file round-trips', () => {
    const text = lockText(['dsa:lc-0001'])
    const { lock } = parseLock(text)
    const ids = ['dsa:lc-0015', 'dsa:lc-0001', 'dsa:lc-0003']
    const diff = diffLock(lock, ids, text)
    expect(diff).toEqual({
      added: ['dsa:lc-0003', 'dsa:lc-0015'],
      removed: [],
      reused: [],
      inBoth: [],
      normalized: true,
    })
    expect(lockIssues(diff, false)).toEqual([])

    const next = updated(lock, diff.added)
    expect(next).toBe(lockText(['dsa:lc-0001', 'dsa:lc-0003', 'dsa:lc-0015']))
    const again = diffLock(parseLock(next).lock, ids, next)
    expect(again.added).toEqual([])
    expect(again.normalized).toBe(true)
    expect(lockIssues(again, true)).toEqual([])
  })

  it('check mode: a new ID is an issue', () => {
    const text = lockText(['dsa:lc-0001'])
    const diff = diffLock(parseLock(text).lock, ['dsa:lc-0001', 'dsa:lc-0002'], text)
    expect(lockIssues(diff, true)).toEqual([
      {
        file: 'content/ids.lock',
        message:
          'content/ids.lock is missing 1 ID — run `pnpm content:build` and commit content/ids.lock',
      },
    ])
    const two = diffLock(EMPTY, ['dsa:lc-0001', 'dsa:lc-0002'], formatLock(EMPTY))
    expect(lockIssues(two, true)[0]?.message).toContain('is missing 2 IDs')
  })

  it('a removed ID is an issue in both modes', () => {
    const text = lockText(['dsa:lc-0001', 'dsa:lc-0002'])
    const diff = diffLock(parseLock(text).lock, ['dsa:lc-0001'], text)
    expect(diff.removed).toEqual(['dsa:lc-0002'])
    const issue = {
      file: 'content/ids.lock',
      message:
        '`dsa:lc-0002` is in content/ids.lock but no longer in content/** — restore it, set `status: retired`, or move it to [retired] (IDs are append-only, ADR-0010)',
    }
    expect(lockIssues(diff, false)).toEqual([issue])
    expect(lockIssues(diff, true)).toEqual([issue])
  })

  it('an ID moved to [retired] may leave content', () => {
    const text = lockText(['dsa:lc-0001'], ['dsa:lc-0002'])
    const diff = diffLock(parseLock(text).lock, ['dsa:lc-0001'], text)
    expect(lockIssues(diff, true)).toEqual([])
  })

  it('a [retired] ID found in content is reused', () => {
    const text = lockText(['dsa:lc-0001'], ['dsa:lc-0002'])
    const diff = diffLock(parseLock(text).lock, ['dsa:lc-0001', 'dsa:lc-0002'], text)
    expect(diff.reused).toEqual(['dsa:lc-0002'])
    expect(diff.added).toEqual([])
    expect(lockIssues(diff, false)).toEqual([
      {
        file: 'content/ids.lock',
        message: '`dsa:lc-0002` is retired in content/ids.lock and cannot be reused',
      },
    ])
  })

  it('an ID in both sections is an issue', () => {
    const text = lockText(['dsa:lc-0001', 'dsa:lc-0002'], ['dsa:lc-0002'])
    const diff = diffLock(parseLock(text).lock, ['dsa:lc-0001'], text)
    expect(diff.inBoth).toEqual(['dsa:lc-0002'])
    expect(diff.removed).toEqual([])
    expect(lockIssues(diff, false)).toEqual([
      {
        file: 'content/ids.lock',
        message: '`dsa:lc-0002` is in both [published] and [retired] in content/ids.lock',
      },
    ])
  })

  it('an unsorted file is not normalised: an issue in check mode, rewritten locally', () => {
    const text = lockText(['dsa:lc-0002', 'dsa:lc-0001'])
    const diff = diffLock(parseLock(text).lock, ['dsa:lc-0001', 'dsa:lc-0002'], text)
    expect(diff.normalized).toBe(false)
    expect(lockIssues(diff, true)).toEqual([
      {
        file: 'content/ids.lock',
        message: 'content/ids.lock is not normalised — run `pnpm content:build`',
      },
    ])
    expect(lockIssues(diff, false)).toEqual([])
    expect(updated(parseLock(text).lock, diff.added)).toBe(lockText(['dsa:lc-0001', 'dsa:lc-0002']))
  })

  it('a missing file is not normalised', () => {
    expect(diffLock(EMPTY, [], '').normalized).toBe(false)
    expect(diffLock(EMPTY, [], formatLock(EMPTY)).normalized).toBe(true)
  })

  it('derived IDs are locked like any other ID', () => {
    const derived = 'english:explaining-code:dsa:lc-0001'
    const text = lockText([derived])
    expect(parseLock(text)).toEqual({ lock: { published: [derived], retired: [] }, issues: [] })
    expect(diffLock(EMPTY, [derived], formatLock(EMPTY)).added).toEqual([derived])
    expect(diffLock(parseLock(text).lock, [], text).removed).toEqual([derived])
  })

  it('names the lock file it was given', () => {
    const diff = diffLock(EMPTY, ['dsa:lc-0001'], '')
    expect(lockIssues(diff, true, 'x/ids.lock').map((issue) => issue.file)).toEqual([
      'x/ids.lock',
      'x/ids.lock',
    ])
  })
})
