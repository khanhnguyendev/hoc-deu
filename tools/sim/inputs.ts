/**
 * The DSA simulation's inputs, extracted from the generated content catalog (platform design
 * §5.11; ADR-0037): the manifest's `srs` (resolved for problems), `estimates.lesson`,
 * `estimates.problem.new`, `review`, `weeklyTemplate` and `defaults`, every roadmap file, and each
 * listed problem's difficulty and topic — only what bots cannot edit (`track.yaml`, `roadmaps/**`,
 * `problem.yaml`). No prompt, lesson or note file is read, so content-only PRs never make the
 * projection table stale. `inputsHash` keys the generated table (`pnpm sim:projections`).
 */
import { createHash } from 'node:crypto'
import type { Catalog } from '@/lib/content/catalog-types'
import type { Roadmap } from '@/lib/content/schemas/roadmap'
import type { PlanRoadmap } from '@/lib/domain/catalog'
import type { SimInputs } from '@/lib/domain/plan/simInputs'
import { RULES_VERSION } from '@/lib/domain/rules'

/** The track whose finish the projection table simulates (§5.11: English has none). */
export const SIM_TRACK_ID = 'dsa'

const byKey = ([a]: readonly [string, unknown], [b]: readonly [string, unknown]): number =>
  a < b ? -1 : a > b ? 1 : 0

/** A roadmap as data only: the fields `PlanRoadmap` has, recap entries without an absent mode. */
function toRoadmap(roadmap: Roadmap): PlanRoadmap {
  return {
    id: roadmap.id,
    weeks: roadmap.weeks.map((week) => ({
      week: week.week,
      topics: week.topics,
      core: week.core,
      bonus: week.bonus,
      recap: week.recap.map((entry) =>
        entry.mode === undefined ? { item: entry.item } : { item: entry.item, mode: entry.mode },
      ),
      decks: week.decks,
    })),
  }
}

/** The DSA inputs of the simulation (decision 20), from `catalog`. Throws when the DSA track, its
 *  lesson or problem estimates, its `review` or a problem a roadmap lists is missing. */
export function simInputs(catalog: Catalog): SimInputs {
  const manifest = catalog.tracks.find((track) => track.id === SIM_TRACK_ID)
  if (manifest === undefined) throw new Error(`simInputs: no "${SIM_TRACK_ID}" track`)
  const { estimates, review } = manifest
  if (estimates.lesson === undefined || estimates.problem === undefined || review === undefined) {
    throw new Error('simInputs: the DSA manifest needs estimates.lesson, estimates.problem, review')
  }

  const { byType, ...base } = manifest.srs
  const srs = { ...base, ...byType?.problem }

  const roadmaps = Object.entries(catalog.roadmaps[SIM_TRACK_ID] ?? {})
    .toSorted(byKey)
    .map(([variant, roadmap]) => [variant, toRoadmap(roadmap)] as const)

  const problemIds = new Set(
    roadmaps.flatMap(([, roadmap]) =>
      roadmap.weeks.flatMap((week) => [
        ...week.core,
        ...week.bonus,
        ...week.recap.map((entry) => entry.item),
      ]),
    ),
  )
  const problems = [...problemIds].toSorted().map((id) => {
    const item = catalog.items[id]
    if (item?.type !== 'problem') {
      throw new Error(`simInputs: a DSA roadmap lists ${id}, which is not a problem in the catalog`)
    }
    return [id, { difficulty: item.content.difficulty, topic: item.content.topic }] as const
  })

  return {
    rulesVersion: RULES_VERSION,
    trackId: SIM_TRACK_ID,
    srs: {
      intervals: srs.intervals,
      relearnDays: srs.relearnDays,
      masteredAfter: srs.masteredAfter,
    },
    estimates: { lesson: estimates.lesson, problem: estimates.problem.new },
    review: { recallMinutes: review.recallMinutes, redoFactor: review.redoFactor },
    weeklyTemplate: manifest.weeklyTemplate,
    defaults: manifest.defaults,
    roadmaps: Object.fromEntries(roadmaps),
    problems: Object.fromEntries(problems),
  }
}

/** JSON with every object's keys sorted, recursively; arrays keep their order. */
export function canonicalJson(value: unknown): string {
  const sorted = (entry: unknown): unknown => {
    if (Array.isArray(entry)) return entry.map(sorted)
    if (entry !== null && typeof entry === 'object') {
      return Object.fromEntries(
        Object.entries(entry)
          .toSorted(byKey)
          .map(([key, inner]) => [key, sorted(inner)]),
      )
    }
    return entry
  }
  return JSON.stringify(sorted(value))
}

/** The projection inputs hash (§5.11, ADR-0037): sha256 hex of `canonicalJson(inputs)`. */
export function inputsHash(inputs: SimInputs): string {
  return createHash('sha256').update(canonicalJson(inputs)).digest('hex')
}
