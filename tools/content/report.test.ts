import { cpSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { Catalog } from '@/lib/content/catalog-types'
import { buildContent } from './build'
import { formatReport } from './report'

const FIXTURES = path.join(import.meta.dirname, '__fixtures__', 'content')

const temps: string[] = []
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true })
})

/** The ok fixture, built from a fresh copy (so the lock adds every ID). */
async function buildOk() {
  const root = mkdtempSync(path.join(tmpdir(), 'content-report-'))
  temps.push(root)
  cpSync(path.join(FIXTURES, 'ok'), path.join(root, 'content'), { recursive: true })
  const result = await buildContent({ repoRoot: root, check: false })
  if (result.catalog === null) throw new Error(result.report)
  return { catalog: result.catalog, lock: result.lock }
}

describe('formatReport', () => {
  it('reports counts, verification, week sizes, coverage, missing roadmaps and drafts (§3.6)', async () => {
    const { catalog, lock } = await buildOk()
    expect(formatReport(catalog, lock, 912)).toMatchInlineSnapshot(`
      "content:build · 2 tracks · 14 items · ids.lock +14 · 0.9 s

      Items            active  draft  retired
        problem             3      1        0
        lesson              2      0        0
        flashcard           3      1        0
        exercise            2      0        0
        prompt              2      0        0

      Verification: tested 1 · compile-only 0 · no note 3

      dsa · active · Cấu trúc dữ liệu & Giải thuật
        8w   1 week · week sizes 3
        10w  2 weeks · week sizes 2 2
        8w coverage  week  notes (placed)  bonus notes  prompts  lessons
                     1     1/3             0/1          0        two-pointers (arrays-hashing missing)
        10w coverage  week  notes (placed)  bonus notes  prompts  lessons
                      1     1/2             0/0          0        — (arrays-hashing missing)
                      2     0/2             0/0          0        two-pointers
      english · active · Tiếng Anh cho môi trường IT
        10w  1 week · week sizes 2
        10w coverage  week  core  extended  exercises  prompts
                      1     2     0         2          1
      Missing roadmaps: english 4w
      Draft tracks: none
      Draft items: dsa:lc-0217, english:w01-heads-up"
    `)
  })

  it('lists draft tracks and draft notes (publish targets, §3.3), and says when nothing is missing', async () => {
    const { catalog, lock } = await buildOk()
    const changed: Catalog = structuredClone(catalog)
    changed.missingRoadmaps = []
    const english = changed.tracks.find((track) => track.id === 'english')
    const twoSum = changed.items['dsa:lc-0001']
    if (english === undefined || twoSum?.type !== 'problem' || twoSum.content.note === null) {
      throw new Error('unexpected ok fixture')
    }
    english.status = 'draft'
    twoSum.content.note.status = 'draft'
    const report = formatReport(changed, lock, 140)
    expect(report.split('\n')[0]).toBe('content:build · 2 tracks · 14 items · ids.lock +14 · 0.1 s')
    expect(report).toContain('\nenglish · draft · Tiếng Anh cho môi trường IT\n')
    expect(report.split('\n').slice(-3)).toEqual([
      'Missing roadmaps: none',
      'Draft tracks: english',
      'Draft items: dsa:lc-0001#note, dsa:lc-0217, english:w01-heads-up',
    ])
  })
})
