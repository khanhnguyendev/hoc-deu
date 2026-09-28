/**
 * Roadmap overrides (platform design §5.12, §6.4.5; Part B-M6 decisions 18, 33, 35; task 6.6b):
 * the per-user changes an AI run may make to a track's plan — `insert_block` (an extra practice
 * block on some weekdays), `extra_week` (a few plans of topic practice instead of new items) and
 * `reorder_topics` (upcoming topics in another order). Pure: the loaders (task 6.6c) read
 * `roadmap_overrides`, keep the rows whose status is `active` and count an `extra_week`'s used
 * days; this module decides what applies today (`overrideActive`), the effective roadmap
 * (`effectiveRoadmap`), the bounds that need the catalog and the learner's state
 * (`validateOverride` — SQL checks the counts, task 6.2b) and the items an override block offers.
 *
 * **Reorder semantics (decision 35).** A topic is *started* when any of its core items is
 * introduced or it is in a week at or before the current roadmap week. A reorder lists every
 * not-started topic in a new order (`validateOverride`); applying it keeps every week's core count
 * and refills the core slots that belong to the listed topics, in the new topic order and each
 * topic's own core order — so the slots before the first not-started topic, and those of topics
 * the order does not list, never change. Bonus problems, recap entries and decks stay with their
 * week; each week's `topics` follow its new core items, so a pattern lesson moves with its topic.
 * The application is a pure function of the stored order (never of the learner's progress): the
 * effective roadmap stays put while the learner works through it, and "started topics never move"
 * holds because the order was checked against the started topics when it was accepted.
 */
import { z } from 'zod'
import {
  isCustomItemId,
  type PlanCatalog,
  type PlanItem,
  type PlanRoadmap,
  type PlanRoadmapWeek,
  type PlanTrack,
  type Weekday,
} from '../catalog'
import { compareIds, own } from '../compare'
import type { ItemState } from '../state'
import { daysBetween, isLocalDay, type LocalDay } from '../time/localDay'
import type { Candidate } from './budget'
import { reviewMode } from './reviewMode'
import { coreItemsOfWeek, roadmapWeek } from './roadmap'
import { type Enrollment, MAX_BLOCK_MINUTES } from './types'

type ItemStates = Readonly<Record<string, ItemState>>

// ---------------------------------------------------------------------------------------------
// Types and parameter schemas (§6.4.5)
// ---------------------------------------------------------------------------------------------

export type InsertBlockParams = {
  topicId: string
  weekdays: readonly Weekday[]
  minutes: number
  until: LocalDay
}
export type ExtraWeekParams = { topicId: string; studyDays: number }
export type ReorderParams = { order: readonly string[] }

export type RoadmapOverride =
  | {
      trackId: string
      key: string
      kind: 'insert_block'
      params: InsertBlockParams
      startLocalDay: LocalDay
    }
  | {
      trackId: string
      key: string
      kind: 'extra_week'
      params: ExtraWeekParams
      startLocalDay: LocalDay
      /** Stored plans dated on or after `startLocalDay` whose track snapshot names this key
       *  (`TrackSnapshot.extraWeek`) — counted by the loader (decision 18). */
      usedDays: number
    }
  | {
      trackId: string
      key: string
      kind: 'reorder_topics'
      params: ReorderParams
      startLocalDay: LocalDay
    }

export type OverrideKind = RoadmapOverride['kind']
export type InsertBlockOverride = Extract<RoadmapOverride, { kind: 'insert_block' }>
export type ExtraWeekOverride = Extract<RoadmapOverride, { kind: 'extra_week' }>

/** A topic ID (the manifest's slug rule). */
const topicIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
const localDaySchema = z.string().refine(isLocalDay, 'not a calendar date (YYYY-MM-DD)')
const weekdaySchema = z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])
const distinct = (values: readonly string[]): boolean => new Set(values).size === values.length

/** The params of each kind, as the bot sends and `roadmap_overrides.params` stores them. The
 *  bounds that depend on the learner (budget share, days ahead, study days) are
 *  `validateOverride`'s, so a lowered limit (`bot_settings.limits`, decision 33) applies. */
export const overrideParamsSchemas: {
  readonly insert_block: z.ZodType<InsertBlockParams>
  readonly extra_week: z.ZodType<ExtraWeekParams>
  readonly reorder_topics: z.ZodType<ReorderParams>
} = {
  insert_block: z.strictObject({
    topicId: topicIdSchema,
    weekdays: z.array(weekdaySchema).min(1).max(7).refine(distinct, 'a weekday twice'),
    minutes: z.number().int().min(1).max(MAX_BLOCK_MINUTES),
    until: localDaySchema,
  }),
  extra_week: z.strictObject({
    topicId: topicIdSchema,
    studyDays: z.number().int().min(1).max(366),
  }),
  reorder_topics: z.strictObject({
    order: z.array(topicIdSchema).min(1).max(64),
  }),
}

/** The hard bounds of §5.12 / §6.4.5 that need the catalog or the learner (decision 33); the
 *  counts (3 active per track, one active `extra_week`, the 21-day cooldown) are SQL's (6.2b).
 *  `bot_settings.limits` may only lower them (`lib/bot/limits.ts`, 6.3). */
export type OverrideLimits = {
  /** `insert_block.minutes` ≤ this share of the track budget. */
  readonly insertBlockMaxBudgetShare: number
  /** `insert_block.until` ≤ this many days after today. */
  readonly insertBlockMaxDaysAhead: number
  /** `extra_week.studyDays` ≤ this. */
  readonly extraWeekMaxStudyDays: number
}

export const OVERRIDE_LIMITS: OverrideLimits = {
  insertBlockMaxBudgetShare: 0.25,
  insertBlockMaxDaysAhead: 14,
  extraWeekMaxStudyDays: 5,
}

/** The tag of an `insert_block`'s practice block. */
export const TOPIC_PRACTICE_TAG = 'topic-practice'
/** The tag of the practice block that replaces the `new` block during an `extra_week`. */
export const EXTRA_WEEK_TAG = 'extra-week'

// ---------------------------------------------------------------------------------------------
// Expiry (decision 18)
// ---------------------------------------------------------------------------------------------

/** Decision 18: whether an override applies on `today` (the SQL rule of 6.2b, same fixtures:
 *  `__tests__/override-expiry.fixtures.json`) — an `insert_block` while `until ≥ today`, an
 *  `extra_week` while fewer than `studyDays` plans named it, a `reorder_topics` until revoked or
 *  replaced (the loader passes `active` rows only). */
export function overrideActive(o: RoadmapOverride, today: LocalDay): boolean {
  switch (o.kind) {
    case 'insert_block':
      // LocalDay is a zero-padded `YYYY-MM-DD` string: string order is chronological order.
      return o.params.until >= today
    case 'extra_week':
      return o.usedDays < o.params.studyDays
    case 'reorder_topics':
      return true
  }
}

/** Start order: `startLocalDay`, then key. */
const byStart = (a: RoadmapOverride, b: RoadmapOverride): number =>
  compareIds(a.startLocalDay, b.startLocalDay) || compareIds(a.key, b.key)

/** The overrides of `trackId` that apply on `today`, in start order. */
export function activeOverrides(
  overrides: readonly RoadmapOverride[],
  trackId: string,
  today: LocalDay,
): RoadmapOverride[] {
  return overrides
    .filter((o) => o.trackId === trackId && overrideActive(o, today))
    .toSorted(byStart)
}

/** The `insert_block`s among `overrides` whose weekdays include `weekday`, in start order. */
export function insertBlocksOn(
  overrides: readonly RoadmapOverride[],
  weekday: Weekday,
): InsertBlockOverride[] {
  return overrides
    .filter((o): o is InsertBlockOverride => o.kind === 'insert_block')
    .filter((o) => o.params.weekdays.includes(weekday))
    .toSorted(byStart)
}

/** The first `extra_week` among `overrides` in start order (SQL allows one active per track),
 *  or null. */
export function extraWeekOf(overrides: readonly RoadmapOverride[]): ExtraWeekOverride | null {
  return (
    overrides.filter((o): o is ExtraWeekOverride => o.kind === 'extra_week').toSorted(byStart)[0] ??
    null
  )
}

// ---------------------------------------------------------------------------------------------
// The effective roadmap (§5.12, decision 35)
// ---------------------------------------------------------------------------------------------

const topicOf = (catalog: PlanCatalog, itemId: string): string | null =>
  own(catalog.items, itemId)?.topicId ?? null

/** Distinct values of `values`, first occurrence first. */
const unique = <T>(values: readonly T[]): T[] => [...new Set(values)]

/** One reorder applied to `roadmap`: the core slots of the topics `order` lists (those that own a
 *  `week.core` slot) are refilled with those topics' core items, in `order`, each topic's items in
 *  roadmap order; every other slot, bonus, recap entry and deck stays. A week's `topics` become
 *  its topics that did not move, then the moved topics of its new core items (first appearance). */
function applyReorder(
  roadmap: PlanRoadmap,
  order: readonly string[],
  catalog: PlanCatalog,
): PlanRoadmap {
  const listed = new Set(order)
  const itemsOfTopic = new Map<string, string[]>()
  for (const week of roadmap.weeks) {
    for (const itemId of week.core) {
      const topic = topicOf(catalog, itemId)
      if (topic === null || !listed.has(topic)) continue
      itemsOfTopic.set(topic, [...(itemsOfTopic.get(topic) ?? []), itemId])
    }
  }
  if (itemsOfTopic.size === 0) return roadmap

  const moves = (topic: string | null): topic is string => topic !== null && itemsOfTopic.has(topic)
  const refill = unique(order).flatMap((topic) => itemsOfTopic.get(topic) ?? [])
  let next = 0
  const weeks = roadmap.weeks.map((week): PlanRoadmapWeek => {
    const touched =
      week.core.some((itemId) => moves(topicOf(catalog, itemId))) || week.topics.some(moves)
    if (!touched) return week
    const core = week.core.map((itemId) => {
      if (!moves(topicOf(catalog, itemId))) return itemId
      const moved = refill[next] ?? itemId
      next += 1
      return moved
    })
    const arrived = unique(core.map((itemId) => topicOf(catalog, itemId)).filter(moves))
    return { ...week, core, topics: [...week.topics.filter((topic) => !moves(topic)), ...arrived] }
  })
  return { ...roadmap, weeks }
}

/**
 * §5.12: the roadmap with upcoming (not-started) topics reordered; started topics never move.
 * Applies `track`'s `reorder_topics` overrides among `overrides` in start order, each on the
 * previous result (the caller passes the active ones, `activeOverrides`). Without one it returns
 * `roadmap` itself, so a plan without overrides is byte-identical to a baseline plan. `items` is
 * the learner's state; the application does not read it (see the module comment: the order was
 * checked against the started topics when it was accepted, so progress never reshuffles it).
 */
export function effectiveRoadmap(
  roadmap: PlanRoadmap,
  track: PlanTrack,
  overrides: readonly RoadmapOverride[],
  catalog: PlanCatalog,
  items: ItemStates,
): PlanRoadmap {
  void items
  return overrides
    .filter(
      (o): o is Extract<RoadmapOverride, { kind: 'reorder_topics' }> =>
        o.trackId === track.id && o.kind === 'reorder_topics',
    )
    .toSorted(byStart)
    .reduce((current, o) => applyReorder(current, o.params.order, catalog), roadmap)
}

/** Every topic, in effective roadmap order (each week's `topics`, then the topics of its core
 *  items), then the manifest topics no week names, in manifest order. */
function topicOrder(roadmap: PlanRoadmap, track: PlanTrack, catalog: PlanCatalog): string[] {
  const fromWeeks = roadmap.weeks.flatMap((week) => [
    ...week.topics,
    ...coreItemsOfWeek(week, catalog).flatMap((itemId) => topicOf(catalog, itemId) ?? []),
  ])
  return unique([...fromWeeks, ...(track.topics ?? []).map((topic) => topic.id)])
}

/** Decision 35: topics with an introduced core item, or in a week at or before the current
 *  roadmap week (its `topics` or the topics of its core items). */
function startedTopics(roadmap: PlanRoadmap, catalog: PlanCatalog, items: ItemStates): Set<string> {
  const current = roadmapWeek(roadmap, catalog, items)
  const started = new Set<string>()
  for (const week of roadmap.weeks) {
    const core = coreItemsOfWeek(week, catalog)
    if (week.week <= current) week.topics.forEach((topic) => started.add(topic))
    for (const itemId of core) {
      const topic = topicOf(catalog, itemId)
      if (topic !== null && (week.week <= current || items[itemId] !== undefined)) {
        started.add(topic)
      }
    }
  }
  return started
}

type TopicState = { readonly order: readonly string[]; readonly started: ReadonlySet<string> }

function topicState(
  track: PlanTrack,
  roadmap: PlanRoadmap,
  overrides: readonly RoadmapOverride[],
  catalog: PlanCatalog,
  items: ItemStates,
): TopicState {
  const effective = effectiveRoadmap(roadmap, track, overrides, catalog, items)
  return {
    order: topicOrder(effective, track, catalog),
    started: startedTopics(effective, catalog, items),
  }
}

/** Upcoming topics of the effective roadmap (context `upcomingTopics`, 6.4b): the not-started
 *  topics in effective roadmap order, then the manifest topics no week names (§6.4.5's example
 *  lists them too). A reorder must list exactly these. */
export function upcomingTopics(
  track: PlanTrack,
  roadmap: PlanRoadmap,
  overrides: readonly RoadmapOverride[],
  catalog: PlanCatalog,
  items: ItemStates,
): string[] {
  const { order, started } = topicState(track, roadmap, overrides, catalog, items)
  return order.filter((topic) => !started.has(topic))
}

// ---------------------------------------------------------------------------------------------
// Validation (§5.12, §6.4.5)
// ---------------------------------------------------------------------------------------------

export type OverrideIssue = {
  key: string
  code:
    | 'bad_params'
    | 'unknown_topic'
    | 'not_upcoming'
    | 'breaks_requires'
    | 'not_permutation'
    | 'over_budget_share'
    | 'until_too_far'
    | 'no_weak_item'
    | 'too_many_days'
}
type IssueCode = OverrideIssue['code']

export type ValidationContext = {
  readonly catalog: PlanCatalog
  /** The learner's enrollment in the override's track. */
  readonly enrollment: Enrollment
  readonly items: ItemStates
  readonly today: LocalDay
  readonly limits: OverrideLimits
  /** The learner's other active overrides (a reorder is checked against their effective
   *  roadmap); one with the same track and key is the one being replaced and is ignored. Absent
   *  = none. */
  readonly overrides?: readonly RoadmapOverride[]
}

/** The topics a param may name: the manifest's, or — for a track that lists none — the topics of
 *  its roadmap weeks and items. */
function knownTopics(track: PlanTrack, catalog: PlanCatalog): ReadonlySet<string> {
  if ((track.topics ?? []).length > 0) return new Set(track.topics?.map((topic) => topic.id))
  const fromRoadmaps = Object.values(track.roadmaps).flatMap((roadmap) =>
    roadmap.weeks.flatMap((week) => week.topics),
  )
  const fromItems = Object.values(catalog.items).flatMap((item) =>
    item.trackId === track.id && item.topicId !== null ? [item.topicId] : [],
  )
  return new Set([...fromRoadmaps, ...fromItems])
}

/** An active catalog item of `trackId` and `topicId` whose state is Weak (§5.7). */
function hasWeakItem(
  catalog: PlanCatalog,
  items: ItemStates,
  trackId: string,
  topicId: string,
): boolean {
  return Object.values(items).some((state) => {
    const item = own(catalog.items, state.itemId)
    return (
      state.status === 'weak' &&
      item?.status === 'active' &&
      item.trackId === trackId &&
      item.topicId === topicId
    )
  })
}

function insertBlockIssues(
  params: InsertBlockParams,
  known: ReadonlySet<string>,
  ctx: ValidationContext,
): IssueCode[] {
  if (params.until < ctx.today) return ['bad_params']
  const issues: IssueCode[] = []
  if (!known.has(params.topicId)) issues.push('unknown_topic')
  if (params.minutes > ctx.limits.insertBlockMaxBudgetShare * ctx.enrollment.budgetMinutes) {
    issues.push('over_budget_share')
  }
  if (daysBetween(ctx.today, params.until) > ctx.limits.insertBlockMaxDaysAhead) {
    issues.push('until_too_far')
  }
  return issues
}

function extraWeekIssues(
  params: ExtraWeekParams,
  known: ReadonlySet<string>,
  ctx: ValidationContext,
): IssueCode[] {
  if (!known.has(params.topicId)) return ['unknown_topic']
  const issues: IssueCode[] = []
  if (params.studyDays > ctx.limits.extraWeekMaxStudyDays) issues.push('too_many_days')
  if (!hasWeakItem(ctx.catalog, ctx.items, ctx.enrollment.trackId, params.topicId)) {
    issues.push('no_weak_item')
  }
  return issues
}

function reorderIssues(
  o: RoadmapOverride,
  params: ReorderParams,
  track: PlanTrack,
  roadmap: PlanRoadmap,
  known: ReadonlySet<string>,
  ctx: ValidationContext,
): IssueCode[] {
  const others = (ctx.overrides ?? []).filter(
    (other) => other.trackId === o.trackId && other.key !== o.key,
  )
  const { order: all, started } = topicState(track, roadmap, others, ctx.catalog, ctx.items)
  const upcoming = all.filter((topic) => !started.has(topic))
  const issues = new Set<IssueCode>()
  for (const topic of params.order) {
    if (!known.has(topic)) issues.add('unknown_topic')
    else if (started.has(topic)) issues.add('not_upcoming')
  }
  const listed = new Set(params.order)
  if (!distinct(params.order) || upcoming.some((topic) => !listed.has(topic))) {
    issues.add('not_permutation')
  }
  if (issues.size > 0) return [...issues]

  const requires = new Map((track.topics ?? []).map((topic) => [topic.id, topic.requires]))
  const position = new Map(params.order.map((topic, index) => [topic, index]))
  const breaks = params.order.some((topic, index) =>
    (requires.get(topic) ?? []).some((required) => {
      if (started.has(required) || !known.has(required)) return false
      return (position.get(required) ?? Infinity) > index
    }),
  )
  return breaks ? ['breaks_requires'] : []
}

/**
 * §6.4.5 bounds that need the catalog and the learner's state (SQL checks the counts, 6.2b):
 * `bad_params` (the kind's schema; `until` before today; another track than the enrollment's),
 * then per kind — `insert_block`: a known topic, `minutes` ≤ the budget share, `until` ≤ the days
 * ahead; `extra_week`: a known topic with a Weak item, `studyDays` ≤ the limit; `reorder_topics`:
 * a permutation of the upcoming topics (unknown → `unknown_topic`, started → `not_upcoming`,
 * missing or repeated → `not_permutation`) whose order puts every topic after the topics it
 * `requires` that have not started (`breaks_requires`). [] = accepted.
 */
export function validateOverride(o: RoadmapOverride, ctx: ValidationContext): OverrideIssue[] {
  const issue = (code: IssueCode): OverrideIssue => ({ key: o.key, code })
  const track = own(ctx.catalog.tracks, o.trackId)
  const roadmap = track === undefined ? undefined : own(track.roadmaps, ctx.enrollment.variant)
  if (track === undefined || roadmap === undefined || o.trackId !== ctx.enrollment.trackId) {
    return [issue('bad_params')]
  }
  const known = knownTopics(track, ctx.catalog)

  switch (o.kind) {
    case 'insert_block': {
      const parsed = overrideParamsSchemas.insert_block.safeParse(o.params)
      if (!parsed.success) return [issue('bad_params')]
      return insertBlockIssues(parsed.data, known, ctx).map(issue)
    }
    case 'extra_week': {
      const parsed = overrideParamsSchemas.extra_week.safeParse(o.params)
      if (!parsed.success) return [issue('bad_params')]
      return extraWeekIssues(parsed.data, known, ctx).map(issue)
    }
    case 'reorder_topics': {
      const parsed = overrideParamsSchemas.reorder_topics.safeParse(o.params)
      if (!parsed.success) return [issue('bad_params')]
      return reorderIssues(o, parsed.data, track, roadmap, known, ctx).map(issue)
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Override blocks' items (§5.12 table)
// ---------------------------------------------------------------------------------------------

/** Which of a topic's items an override block offers: an `insert_block` its Weak or due items,
 *  an `extra_week` every introduced item (both in review modes); then the learner's custom items
 *  of the topic. */
export type TopicPool = 'weak-or-due' | 'introduced'

const reviewable = (state: ItemState | undefined): state is ItemState =>
  state !== undefined && state.status !== 'mastered' && state.status !== 'skipped'

/** Weak first → due first (earliest `dueOn`) → lowest level → oldest last result → ID. */
function compareTopicItems(a: ItemState, b: ItemState): number {
  return (
    Number(b.weak) - Number(a.weak) ||
    compareIds(a.dueOn ?? '9999-12-31', b.dueOn ?? '9999-12-31') ||
    a.level - b.level ||
    compareIds(a.lastResultOn ?? '', b.lastResultOn ?? '') ||
    compareIds(a.itemId, b.itemId)
  )
}

/**
 * §5.12: the candidates of an override block on `topicId` of `trackId`, in order — the topic's
 * active SRS catalog items (not custom) the learner has introduced and may review (not mastered,
 * not skipped): for `weak-or-due` only those that are Weak or due on `today`; sorted Weak first,
 * then by due date, level, last result and ID; each in its review mode (`reviewMode`). Then the
 * active custom items (`user:…`, decision 17) of the topic that are not mastered or skipped, by
 * ID: introduced ones in their review mode, new ones in mode `new` — at most `newCap` new SRS
 * ones (null = no cap). Items in `exclude` are left out.
 */
export function topicPracticeCandidates(input: {
  readonly trackId: string
  readonly topicId: string
  readonly pool: TopicPool
  readonly catalog: PlanCatalog
  readonly items: ItemStates
  readonly today: LocalDay
  readonly exclude: ReadonlySet<string>
  readonly newCap: number | null
}): Candidate[] {
  const { trackId, topicId, pool, catalog, items, today, exclude, newCap } = input
  const ofTopic = Object.values(catalog.items).filter(
    (item) =>
      item.trackId === trackId &&
      item.topicId === topicId &&
      item.status === 'active' &&
      !exclude.has(item.id),
  )
  const candidate = (item: PlanItem, state: ItemState | undefined): Candidate => {
    const mode = state === undefined ? 'new' : reviewMode(item, state)
    return {
      itemId: item.id,
      mode,
      minutes: item.minutes[mode],
      srs: mode === 'new' && item.srs !== null,
    }
  }

  const topicItems = ofTopic
    .flatMap((item) => {
      const state = items[item.id]
      if (isCustomItemId(item.id) || item.srs === null || !reviewable(state)) return []
      const due = state.dueOn !== null && state.dueOn <= today
      return pool === 'introduced' || state.status === 'weak' || due ? [{ item, state }] : []
    })
    .toSorted((a, b) => compareTopicItems(a.state, b.state))
    .map(({ item, state }) => candidate(item, state))

  let newLeft = newCap ?? Infinity
  const custom = ofTopic
    .filter((item) => isCustomItemId(item.id))
    .toSorted((a, b) => compareIds(a.id, b.id))
    .flatMap((item) => {
      const state = items[item.id]
      if (state !== undefined && !reviewable(state)) return []
      const next = candidate(item, state)
      if (next.srs) {
        if (newLeft <= 0) return []
        newLeft -= 1
      }
      return [next]
    })
  return [...topicItems, ...custom]
}
