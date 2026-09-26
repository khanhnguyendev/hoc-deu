/**
 * Roadmap position, the new-item queue and the recap source (platform design §5.3, §5.6; Part B-M4
 * decisions 15 and 16). Pure functions over the plan catalog and the learner's item states.
 */
import {
  type CardTier,
  isActiveItem,
  type ItemMode,
  type PlanCatalog,
  type PlanItem,
  type PlanRoadmap,
  type PlanRoadmapWeek,
} from '../catalog'
import { compareIds } from '../compare'
import type { ItemState } from '../state'
import { reviewMode } from './reviewMode'

type ItemStates = Readonly<Record<string, ItemState>>

/** The cards of a week's decks with `tier`, in deck order then card order. */
function deckCards(week: PlanRoadmapWeek, catalog: PlanCatalog, tier: CardTier): string[] {
  return week.decks.flatMap((deckId) =>
    (catalog.decks[deckId]?.cardIds ?? []).filter((id) => catalog.items[id]?.tier === tier),
  )
}

/** A week's core items (§3.4): `week.core`, then the `core`-tier cards of `week.decks` (deck
 *  order, card order), whatever their status. */
export function coreItemsOfWeek(week: PlanRoadmapWeek, catalog: PlanCatalog): string[] {
  return [...week.core, ...deckCards(week, catalog, 'core')]
}

/** Core items per week (§3.4 week sizes). */
export function weekSizes(roadmap: PlanRoadmap, catalog: PlanCatalog): number[] {
  return roadmap.weeks.map((week) => coreItemsOfWeek(week, catalog).length)
}

/** A core item counts as passed when introduced (it has a row) or not active in the catalog
 *  (draft, retired, missing) — decision 16. */
export function isPassed(itemId: string, catalog: PlanCatalog, items: ItemStates): boolean {
  return items[itemId] !== undefined || !isActiveItem(catalog, itemId)
}

/** §5.3: the first week w whose cumulative size exceeds `passedCore`, clamped to the last week;
 *  1 when `sizes` is empty. [8, 8, 7]: 0 → 1, 7 → 1, 8 → 2, 20 → 3, 99 → 3. */
export function weekForProgress(passedCore: number, sizes: readonly number[]): number {
  let cumulative = 0
  for (const [index, size] of sizes.entries()) {
    cumulative += size
    if (cumulative > passedCore) return index + 1
  }
  return Math.max(sizes.length, 1)
}

/** Each week's active core items; draft, retired and missing ones count nowhere (decision 16). */
function activeCoreItems(roadmap: PlanRoadmap, catalog: PlanCatalog): string[][] {
  return roadmap.weeks.map((week) =>
    coreItemsOfWeek(week, catalog).filter((id) => isActiveItem(catalog, id)),
  )
}

/** The learner's roadmap week on this track (decision 16, as amended): weekForProgress over
 *  ACTIVE core items only — the introduced active ones against the active ones per week; 1
 *  without a roadmap. */
export function roadmapWeek(
  roadmap: PlanRoadmap | null,
  catalog: PlanCatalog,
  items: ItemStates,
): number {
  if (roadmap === null) return 1
  const weeks = activeCoreItems(roadmap, catalog)
  const introducedCore = weeks.flat().filter((id) => items[id] !== undefined).length
  return weekForProgress(
    introducedCore,
    weeks.map((week) => week.length),
  )
}

/** The derived cards of `trackId` whose source has a result, by (source introducedOn, source ID). */
function unlockedDerivedCards(trackId: string, catalog: PlanCatalog, items: ItemStates): string[] {
  return Object.values(catalog.items)
    .flatMap((card) => {
      if (card.trackId !== trackId || card.tier !== 'derived' || card.derivedFrom === null)
        return []
      const source = items[card.derivedFrom]
      return source === undefined || source.lastResultOn === null ? [] : [{ card, source }]
    })
    .toSorted(
      (a, b) =>
        compareIds(a.source.introducedOn, b.source.introducedOn) ||
        compareIds(a.source.itemId, b.source.itemId) ||
        compareIds(a.card.id, b.card.id),
    )
    .map(({ card }) => card.id)
}

/** §5.3 new-item queue: active, not-introduced item IDs in roadmap order — per week: pattern
 *  lessons of its topics (lessons with that topic and `about === null`, in `week.topics` order then
 *  ID), core items, recap entries without a mode, [unlocked derived cards — once, see below],
 *  extended cards, bonus problems (only with `includeBonus`). An item appears at most once.
 *  Unlocked derived cards of `trackId` (tier `derived`, their source has `lastResultOn !== null`),
 *  ordered by (source introducedOn, source ID) — stable, decision 15 — go into the first week that
 *  still has a not-introduced item of its own, after its recap items; with no such week, at the
 *  end. Without a roadmap only the derived cards remain. */
export function newQueue(input: {
  readonly trackId: string
  readonly roadmap: PlanRoadmap | null
  readonly catalog: PlanCatalog
  readonly items: ItemStates
  readonly includeBonus: boolean
}): string[] {
  const { trackId, roadmap, catalog, items, includeBonus } = input
  const queued = new Set<string>()
  /** The IDs of `ids` the queue takes: active, not introduced, not queued before — in order. */
  const take = (ids: readonly string[]): string[] =>
    ids.filter((id) => {
      if (queued.has(id) || items[id] !== undefined || !isActiveItem(catalog, id)) return false
      queued.add(id)
      return true
    })

  const patternLessons: readonly PlanItem[] = Object.values(catalog.items).filter(
    (item) => item.trackId === trackId && item.itemType === 'lesson' && item.about === null,
  )
  const lessonsOf = (week: PlanRoadmapWeek): string[] =>
    week.topics.flatMap((topic) =>
      patternLessons
        .filter((lesson) => lesson.topicId === topic)
        .map((lesson) => lesson.id)
        .toSorted(compareIds),
    )

  const weeks = (roadmap?.weeks ?? []).map((week) => ({
    head: take([
      ...lessonsOf(week),
      ...coreItemsOfWeek(week, catalog),
      ...week.recap.filter((entry) => entry.mode === undefined).map((entry) => entry.item),
    ]),
    tail: take([...deckCards(week, catalog, 'extended'), ...(includeBonus ? week.bonus : [])]),
  }))
  const derived = take(unlockedDerivedCards(trackId, catalog, items))

  const home = weeks.findIndex((week) => week.head.length + week.tail.length > 0)
  if (home === -1) return derived
  return weeks.flatMap((week, index) =>
    index === home ? [...week.head, ...derived, ...week.tail] : [...week.head, ...week.tail],
  )
}

/** §5.6: the latest week w ≤ currentWeek whose core items are all passed and w ∉ done; null when
 *  none. */
export function recapSource(input: {
  readonly roadmap: PlanRoadmap | null
  readonly catalog: PlanCatalog
  readonly items: ItemStates
  readonly done: ReadonlySet<number>
  readonly currentWeek: number
}): number | null {
  const { roadmap, catalog, items, done, currentWeek } = input
  const ready = (roadmap?.weeks ?? [])
    .filter(
      (week) =>
        week.week <= currentWeek &&
        !done.has(week.week) &&
        coreItemsOfWeek(week, catalog).every((id) => isPassed(id, catalog, items)),
    )
    .map((week) => week.week)
  return ready.length === 0 ? null : Math.max(...ready)
}

export type RecapPick = { readonly itemId: string; readonly mode: ItemMode }

/** §5.6 recap items, at most `count`: the source week's recap entries that have a mode, whose item
 *  is active and introduced (level ≥ 1), in file order, with that mode; then filler — the track's
 *  other introduced SRS items (level ≥ 1, not mastered, active), sorted by (level, lastResultOn,
 *  ID), each time preferring a topic not picked yet ("spread across topics"), in their review
 *  mode (`reviewMode`: Weak problem → 'redo', other problem → 'recall', card → 'review').
 *  `week: null` = filler only. Items in `exclude` are never picked, nor items the learner skipped
 *  out of review (status `skipped`, level kept) — as `dueQueue` (final review M-12). */
export function recapCandidates(input: {
  readonly trackId: string
  readonly roadmap: PlanRoadmap | null
  readonly week: number | null
  readonly catalog: PlanCatalog
  readonly items: ItemStates
  readonly count: number
  readonly exclude: ReadonlySet<string>
}): RecapPick[] {
  const { trackId, roadmap, week, catalog, items, count, exclude } = input
  const picks: RecapPick[] = []
  const pickedTopics = new Set<string | null>()
  const isPicked = (itemId: string): boolean => picks.some((pick) => pick.itemId === itemId)
  const pick = (item: PlanItem, mode: ItemMode): void => {
    picks.push({ itemId: item.id, mode })
    pickedTopics.add(item.topicId)
  }

  const source =
    week === null ? undefined : roadmap?.weeks.find((candidate) => candidate.week === week)
  const entries = source?.recap ?? []
  for (const entry of entries) {
    if (picks.length >= count) break
    const item = catalog.items[entry.item]
    const state = items[entry.item]
    if (entry.mode === undefined || item === undefined || item.status !== 'active') continue
    if (state === undefined || state.level < 1 || state.status === 'skipped') continue
    if (exclude.has(item.id) || isPicked(item.id)) continue
    pick(item, entry.mode)
  }

  const filler = Object.values(items)
    .flatMap((state) => {
      const item = catalog.items[state.itemId]
      if (item === undefined || item.trackId !== trackId || item.status !== 'active') return []
      if (state.level < 1 || state.status === 'mastered' || state.status === 'skipped') return []
      return exclude.has(item.id) || isPicked(item.id) ? [] : [{ item, state }]
    })
    .toSorted(
      (a, b) =>
        a.state.level - b.state.level ||
        compareIds(a.state.lastResultOn ?? '', b.state.lastResultOn ?? '') ||
        compareIds(a.item.id, b.item.id),
    )
  while (picks.length < count && filler.length > 0) {
    const newTopic = filler.findIndex(({ item }) => !pickedTopics.has(item.topicId))
    const [next] = filler.splice(Math.max(newTopic, 0), 1)
    if (next !== undefined) pick(next.item, reviewMode(next.item, next.state))
  }
  return picks
}
