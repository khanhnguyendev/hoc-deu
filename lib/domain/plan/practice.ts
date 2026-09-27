/**
 * Practice pickers (platform design §5.6): what a `practice` template block shows — exercises and
 * prompts by `itemType` / `tag`, shadowing's example sentences, and the mock-interview problem
 * (a helper for M5's prompt page, Part B-M4 decision 24 — not a second item in the block).
 */
import type { PlanCatalog, PlanItem } from '../catalog'
import { compareIds } from '../compare'
import type { ItemState } from '../state'

/** The tag whose block shows example sentences instead of an item (§5.6). */
export const SHADOWING_TAG = 'shadowing'

/** Rank of a last grade for "the worst last grade first" (§5.6): miss, close, pass, anything else. */
export const GRADE_RANK: Readonly<Record<string, number>> = { miss: 0, close: 1, pass: 2 }

const byId = (a: PlanItem, b: PlanItem): number => compareIds(a.id, b.id)

function gradeRank(lastResult: string | null): number {
  if (lastResult === null) return Number.POSITIVE_INFINITY
  return GRADE_RANK[lastResult] ?? Number.POSITIVE_INFINITY
}

/** Older (smaller) `lastResultOn` first; a missing date sorts last. */
function compareLastResultOn(a: ItemState, b: ItemState): number {
  if (a.lastResultOn === b.lastResultOn) return 0
  if (a.lastResultOn === null) return 1
  if (b.lastResultOn === null) return -1
  return a.lastResultOn < b.lastResultOn ? -1 : 1
}

function activeItemsOf(catalog: PlanCatalog, trackId: string): PlanItem[] {
  return Object.values(catalog.items).filter(
    (item) => item.trackId === trackId && item.status === 'active',
  )
}

/**
 * A `practice` block with `itemType` (§5.6 exercise rule, generic): the first active, not-introduced
 * item of that type whose `week` is `roadmapWeek` (ID order); else the introduced one — never one
 * the learner skipped (status `skipped`, as `dueQueue`; final review M-12) — with the worst last
 * grade (`GRADE_RANK`, unknown grades last), oldest `lastResultOn`, then ID; else null.
 */
export function pickByItemType(input: {
  readonly trackId: string
  readonly itemType: string
  readonly roadmapWeek: number
  readonly items: Readonly<Record<string, ItemState>>
  readonly catalog: PlanCatalog
}): string | null {
  const { trackId, itemType, roadmapWeek, items, catalog } = input
  const candidates = activeItemsOf(catalog, trackId).filter((item) => item.itemType === itemType)

  const notIntroducedThisWeek = candidates
    .filter((item) => item.week === roadmapWeek && items[item.id] === undefined)
    .sort(byId)
  if (notIntroducedThisWeek.length > 0) return notIntroducedThisWeek[0]!.id

  const introduced = candidates.filter((item) => {
    const state = items[item.id]
    return state !== undefined && state.status !== 'skipped'
  })
  if (introduced.length === 0) return null

  const worst = [...introduced].sort((a, b) => {
    const stateA = items[a.id]!
    const stateB = items[b.id]!
    const rankDiff = gradeRank(stateA.lastResult) - gradeRank(stateB.lastResult)
    if (rankDiff !== 0) return rankDiff
    const dateDiff = compareLastResultOn(stateA, stateB)
    if (dateDiff !== 0) return dateDiff
    return byId(a, b)
  })
  return worst[0]!.id
}

/**
 * A `practice` block with `tag`: the first active repeatable prompt with that tag (ID order); else
 * the active, not-introduced one with `week === roadmapWeek`; else the earliest (week, ID) active,
 * not-introduced one with a lower week; else null.
 */
export function pickByTag(input: {
  readonly trackId: string
  readonly tag: string
  readonly roadmapWeek: number
  readonly items: Readonly<Record<string, ItemState>>
  readonly catalog: PlanCatalog
}): string | null {
  const { trackId, tag, roadmapWeek, items, catalog } = input
  const candidates = activeItemsOf(catalog, trackId).filter((item) => item.tag === tag)

  const repeatable = candidates.filter((item) => item.repeatable).sort(byId)
  if (repeatable.length > 0) return repeatable[0]!.id

  const notIntroduced = candidates.filter((item) => items[item.id] === undefined)

  const thisWeek = notIntroduced.filter((item) => item.week === roadmapWeek).sort(byId)
  if (thisWeek.length > 0) return thisWeek[0]!.id

  const earlier = [
    ...notIntroduced.filter((item) => item.week !== null && item.week < roadmapWeek),
  ].sort((a, b) => (a.week! !== b.week! ? a.week! - b.week! : byId(a, b)))
  if (earlier.length > 0) return earlier[0]!.id

  return null
}

/**
 * Shadowing (§5.6): up to `count` of today's new cards that have an example, in plan order; when
 * none, the track's most recently introduced cards with an example (`introducedOn` desc, ID),
 * except cards the learner skipped out of review (status `skipped`, as `dueQueue`; M-12).
 */
export function pickShadowing(input: {
  readonly trackId: string
  readonly todaysNew: readonly string[]
  readonly items: Readonly<Record<string, ItemState>>
  readonly catalog: PlanCatalog
  readonly count?: number
}): string[] {
  const { trackId, todaysNew, items, catalog, count = 3 } = input

  const fromNew = todaysNew.filter((itemId) => {
    const item = catalog.items[itemId]
    return (
      item !== undefined && item.trackId === trackId && item.status === 'active' && item.hasExample
    )
  })
  if (fromNew.length > 0) return fromNew.slice(0, count)

  return Object.entries(items)
    .filter(([itemId, state]) => {
      if (state.trackId !== trackId || state.status === 'skipped') return false
      const item = catalog.items[itemId]
      return item !== undefined && item.status === 'active' && item.hasExample
    })
    .sort(([idA, stateA], [idB, stateB]) => {
      if (stateA.introducedOn !== stateB.introducedOn) {
        return stateA.introducedOn < stateB.introducedOn ? 1 : -1
      }
      return compareIds(idA, idB)
    })
    .slice(0, count)
    .map(([itemId]) => itemId)
}

/**
 * §5.6: the introduced (level ≥ 1) active Medium problem of the track with the oldest
 * `lastResultOn`, then ID — never one the learner skipped out of review (status `skipped`, as
 * `dueQueue`; M-12); null when none. For M5's mock-interview prompt page.
 */
export function mockInterviewProblem(input: {
  readonly trackId: string
  readonly items: Readonly<Record<string, ItemState>>
  readonly catalog: PlanCatalog
}): string | null {
  const { trackId, items, catalog } = input

  const candidates = Object.entries(items)
    .filter(([itemId, state]) => {
      if (state.trackId !== trackId) return false
      if (state.level < 1 || state.status === 'skipped') return false
      const item = catalog.items[itemId]
      return item !== undefined && item.status === 'active' && item.difficulty === 'M'
    })
    .sort(([idA, stateA], [idB, stateB]) => {
      const dateDiff = compareLastResultOn(stateA, stateB)
      if (dateDiff !== 0) return dateDiff
      return compareIds(idA, idB)
    })

  return candidates.length > 0 ? candidates[0]![0] : null
}
