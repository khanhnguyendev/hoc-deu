/**
 * Pins the DSA content that is the input of the §5.10/§5.11 simulation
 * (`docs/plans/assets/2026-09-23-plan-sim.py`, `W10` and `W8`; task 3.6, fix 20): each roadmap's
 * `core` and `recap` lists (items and modes) and the difficulty of every core and recap problem —
 * the M4 projection hash reads them. Nothing else about the content is asserted, so a later
 * content PR that adds problems, notes, lessons or bonus items never touches this test.
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Catalog } from '@/lib/content/catalog-types'
import { buildContent } from './build'

const REPO = path.resolve(import.meta.dirname, '../..')

/**
 * One roadmap week as in the brief's tables: `core` is `<LeetCode number> <difficulty>` and
 * `recap` is `<LeetCode number> <difficulty> <mode>`, where `new` means a recap entry without a
 * mode (it introduces the problem).
 */
type TableWeek = { core: string; recap: string }

const TEN_WEEKS: readonly TableWeek[] = [
  {
    core: '217 E, 242 E, 1 E, 49 M, 347 M, 238 M, 128 M, 36 M',
    recap: '271 M new, 128 M redo, 49 M explain-aloud',
  },
  {
    core: '125 E, 121 E, 167 M, 15 M, 11 M, 3 M, 424 M, 42 H',
    recap: '1 E explain-aloud, 567 M new, 347 M redo',
  },
  {
    core: '20 E, 704 E, 155 M, 739 M, 875 M, 153 M, 981 M, 84 H',
    recap: '424 M redo, 150 M new, 238 M redo',
  },
  {
    core: '206 E, 21 E, 141 E, 19 M, 143 M, 2 M, 146 M, 23 H',
    recap: '74 M new, 3 M redo, 138 M new',
  },
  {
    core: '226 E, 104 E, 100 E, 543 E, 102 M, 98 M, 230 M, 124 H',
    recap: '146 M redo, 199 M new, 128 M redo',
  },
  {
    core: '703 E, 1046 E, 973 M, 215 M, 621 M, 355 M, 295 H',
    recap: '347 M redo, 230 M redo, 981 M redo',
  },
  {
    core: '78 M, 39 M, 46 M, 90 M, 40 M, 79 M, 17 M, 51 H',
    recap: '22 M new, 572 E new, 215 M redo',
  },
  {
    core: '200 M, 695 M, 133 M, 994 M, 417 M, 207 M, 210 M, 127 H',
    recap: '79 M redo, 102 M redo, 739 M redo',
  },
  {
    core: '70 E, 198 M, 213 M, 5 M, 91 M, 322 M, 139 M, 300 M',
    recap: '994 M redo, 647 M new, 42 H redo',
  },
  {
    core: '62 M, 1143 M, 56 M, 57 M, 435 M, 253 M, 53 M, 763 M',
    recap: '146 M redo, 295 H redo, 380 M new',
  },
]

const EIGHT_WEEKS: readonly TableWeek[] = [
  {
    core: '217 E, 242 E, 1 E, 49 M, 347 M, 238 M, 128 M, 36 M',
    recap: '271 M new, 128 M redo, 49 M explain-aloud',
  },
  {
    core: '125 E, 121 E, 167 M, 15 M, 11 M, 3 M, 424 M, 42 H',
    recap: '1 E explain-aloud, 347 M redo, 3 M redo',
  },
  {
    core: '20 E, 704 E, 155 M, 739 M, 875 M, 153 M, 981 M',
    recap: '424 M redo, 238 M redo, 739 M redo',
  },
  {
    core: '206 E, 21 E, 141 E, 146 M, 226 E, 104 E, 100 E, 543 E, 102 M, 98 M, 230 M',
    recap: '146 M redo, 128 M redo, 102 M redo',
  },
  {
    core: '703 E, 973 M, 215 M, 78 M, 39 M, 46 M, 79 M',
    recap: '347 M redo, 230 M redo, 981 M redo',
  },
  {
    core: '200 M, 695 M, 133 M, 994 M, 417 M, 207 M, 210 M',
    recap: '79 M redo, 102 M redo, 739 M redo',
  },
  {
    core: '70 E, 198 M, 213 M, 5 M, 91 M, 322 M, 139 M, 300 M',
    recap: '994 M redo, 42 H redo, 5 M redo',
  },
  {
    core: '62 M, 1143 M, 56 M, 57 M, 435 M, 253 M, 53 M, 763 M',
    recap: '146 M redo, 215 M redo, 380 M new',
  },
]

const problemId = (leetcode: string): string => `dsa:lc-${leetcode.padStart(4, '0')}`

/** `'217 E, 49 M'` → `[['217', 'E'], ['49', 'M']]` */
const cells = (list: string): string[][] => list.split(', ').map((cell) => cell.split(' '))

const coreOf = (week: TableWeek): string[] => cells(week.core).map(([n = '']) => problemId(n))

const recapOf = (week: TableWeek): { item: string; mode?: string }[] =>
  cells(week.recap).map(([n = '', , mode = '']) =>
    mode === 'new' ? { item: problemId(n) } : { item: problemId(n), mode },
  )

/** Problem ID → difficulty, for every core and recap problem of a table (which must agree). */
function difficultiesOf(weeks: readonly TableWeek[]): Record<string, string> {
  const difficulties: Record<string, string> = {}
  for (const week of weeks) {
    for (const [n = '', difficulty = ''] of [...cells(week.core), ...cells(week.recap)]) {
      const id = problemId(n)
      const known = difficulties[id]
      if (known !== undefined && known !== difficulty) {
        throw new Error(`the table gives ${id} two difficulties (${known}, ${difficulty})`)
      }
      difficulties[id] = difficulty
    }
  }
  return difficulties
}

const ROADMAPS = [
  { variant: '10w', table: TEN_WEEKS, sizes: [8, 8, 8, 8, 8, 7, 8, 8, 8, 8] },
  { variant: '8w', table: EIGHT_WEEKS, sizes: [8, 8, 7, 11, 7, 7, 8, 8] },
] as const

let outDir = ''
let catalog: Catalog | null = null

beforeAll(async () => {
  outDir = mkdtempSync(path.join(tmpdir(), 'dsa-content-'))
  const result = await buildContent({ repoRoot: REPO, outDir, check: true })
  expect(result.issues).toEqual([])
  catalog = result.catalog
})

afterAll(() => {
  if (outDir !== '') rmSync(outDir, { recursive: true, force: true })
})

function roadmapOf(variant: string) {
  const roadmap = catalog?.roadmaps.dsa?.[variant]
  if (roadmap === undefined)
    throw new Error(`content/tracks/dsa/roadmaps/${variant}.yaml is missing`)
  return roadmap
}

describe.each(ROADMAPS)('the DSA $variant roadmap (the simulation input)', (roadmap) => {
  it('has the core and recap lists of the table, recap modes included', () => {
    const weeks = roadmapOf(roadmap.variant).weeks
    expect(weeks.map((week) => week.core)).toEqual(roadmap.table.map(coreOf))
    expect(weeks.map((week) => week.recap)).toEqual(roadmap.table.map(recapOf))
  })

  it('has the week sizes of the table', () => {
    const weeks = roadmapOf(roadmap.variant).weeks
    expect(weeks.map((week) => week.core.length)).toEqual(roadmap.sizes)
  })

  it('gives every core and recap problem the difficulty of the table', () => {
    const expected = difficultiesOf(roadmap.table)
    const actual = Object.fromEntries(
      Object.keys(expected).map((id) => {
        const item = catalog?.items[id]
        return [id, item?.type === 'problem' ? item.content.difficulty : `missing (${id})`]
      }),
    )
    expect(actual).toEqual(expected)
  })
})
