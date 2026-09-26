/**
 * `/today` as data (platform design §2.4, §5.2, §5.5–§5.7; Part B-M5 task 5.1b): the blocks the
 * dashboard shows for each state, per-track progress, the streak, weak topics, and which plan the
 * browser marks seen. No React, no I/O: `ensureToday`'s `TodayData` and the `daily_activity` rows
 * come in; the track manifests (titles, accents, topic titles) are read from the generated
 * catalog, which the tests replace.
 */
import { itemHref } from '@/features/items/href'
import { getTrack } from '@/lib/content/catalog'
import { isActiveItem, type ItemMode, type PlanCatalog } from '@/lib/domain/catalog'
import { dueQueue } from '@/lib/domain/plan/queues'
import { coreItemsOfWeek, roadmapWeek, weekSizes } from '@/lib/domain/plan/roadmap'
import type { Enrollment, PlanBlock, StoredPlan } from '@/lib/domain/plan/types'
import { blockKey, type BlockState, type DailyActivity } from '@/lib/domain/state'
import { scheduleSkippedDays, streak } from '@/lib/domain/stats/streak'
import { weakTopics } from '@/lib/domain/stats/weakTopics'
import type { LocalDay } from '@/lib/domain/time/localDay'
import { fill, formatNumber } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'
import type { TodayData } from '@/lib/plans/today'

const copy = vi.today

export type BlockView = {
  readonly block: PlanBlock
  readonly trackTitle: string
  readonly accent: string
  /** "Ôn tập", "Bài mới", "Ôn tuần 1", "Mock interview", "Shadowing", "Học thêm", … */
  readonly kindLabel: string
  readonly minutes: number
  /** DESIGN_SYSTEM "dài hơn thời gian dự kiến": a new item flagged overBudget, or a practice
   *  block longer than the track's budget (M4-R10). */
  readonly overBudget: boolean
  readonly checkIn: BlockState | null
  /** Item links: `/t/<track>/items/<id>?block=<blockId>&mode=<mode>`. */
  readonly items: readonly {
    readonly itemId: string
    readonly mode: ItemMode
    readonly href: string
  }[]
}

export type TrackProgressView = {
  readonly trackId: string
  readonly title: string
  readonly accent: string
  readonly week: number
  readonly weeks: number
  /** Introduced core items / core items of the variant (0–1). */
  readonly progress: number
  readonly dueCount: number
  /** "Đang có {n} thẻ cần ôn — tạm giảm thẻ mới." when the plan's snapshot says throttled. */
  readonly throttleMessage: string | null
}

export type WeakTopicView = {
  /** The topic's track: WeakAreas links to `/t/<trackId>`. */
  readonly trackId: string
  readonly title: string
  readonly trackTitle: string
  readonly count: number
}

export type TodayPage = {
  readonly data: TodayData
  readonly blocks: readonly BlockView[]
  readonly tracks: readonly TrackProgressView[]
  readonly streak: number
  readonly weakTopics: readonly WeakTopicView[]
  /** The plan <MarkPlanSeen> marks: today's plan when the state is `plan`, else null. */
  readonly markSeenPlanId: string | null
  /** Per render (decision 16): the check-in and "Học thêm" forms derive event ids from it. */
  readonly requestId: string
}

/** A track the catalog no longer lists still renders: its ID as title, the first accent. */
const FALLBACK_ACCENT = 'track-1'

function trackInfo(trackId: string): { title: string; accent: string } {
  const track = getTrack(trackId)
  return { title: track?.title.vi ?? trackId, accent: track?.accent ?? FALLBACK_ACCENT }
}

function topicTitle(trackId: string, topicId: string): string {
  return getTrack(trackId)?.topics.find((topic) => topic.id === topicId)?.title.vi ?? topicId
}

/** `label[key]` for an own key only (a tag such as `toString` is not a label). */
function ownLabel(
  labels: Readonly<Record<string, string>>,
  key: string | undefined,
): string | null {
  return key !== undefined && Object.hasOwn(labels, key) ? (labels[key] ?? null) : null
}

function kindLabel(block: PlanBlock): string {
  switch (block.kind) {
    case 'review':
      return copy.kind.review
    case 'new':
      return copy.kind.new
    case 'recap':
      return typeof block.recapWeek === 'number'
        ? fill(copy.kind.recap, { week: formatNumber(block.recapWeek) })
        : copy.kind.recapFiller
    case 'practice':
      return ownLabel(copy.practice, block.tag ?? block.itemType) ?? copy.kind.practice
    case 'extra':
      return copy.kind.extra
  }
}

/**
 * `/t/<track>/items/<local id>?block=<blockId>&mode=<mode>`: the track is the ID's first segment
 * and the rest its local ID (`itemHref` encodes a derived card's colons).
 */
function blockItemHref(itemId: string, blockId: string, mode: ItemMode): string {
  const separator = itemId.indexOf(':')
  const path = itemHref({
    trackId: itemId.slice(0, separator),
    localId: itemId.slice(separator + 1),
  })
  return `${path}?${new URLSearchParams({ block: blockId, mode }).toString()}`
}

/** M4-R10: practice items never carry the flag — the block's own minutes decide. */
function isOverBudget(block: PlanBlock, budget: number | null): boolean {
  if (block.items.some((item) => item.overBudget === true)) return true
  return block.kind === 'practice' && budget !== null && block.estMinutes > budget
}

function blockViews(
  plan: StoredPlan,
  blocks: readonly PlanBlock[],
  states: Readonly<Record<string, BlockState>>,
  enrollments: readonly Enrollment[],
): BlockView[] {
  const budgets = new Map(enrollments.map((entry) => [entry.trackId, entry.budgetMinutes]))
  return blocks.map((block) => {
    const { title, accent } = trackInfo(block.trackId)
    return {
      block,
      trackTitle: title,
      accent,
      kindLabel: kindLabel(block),
      minutes: block.estMinutes,
      overBudget: isOverBudget(block, budgets.get(block.trackId) ?? null),
      checkIn: states[blockKey(plan.id, block.id)] ?? null,
      items: block.items.map(({ itemId, mode }) => ({
        itemId,
        mode,
        href: blockItemHref(itemId, block.id, mode),
      })),
    }
  })
}

/** The blocks each state shows: today's or the resumed plan's, or the paused plan's unfinished. */
function stateBlocks(data: TodayData): BlockView[] {
  const { state, enrollments } = data
  switch (state.kind) {
    case 'plan':
    case 'resumed':
      return blockViews(state.plan, state.plan.blocks, state.blocks, enrollments)
    case 'paused':
      return blockViews(state.plan, state.unfinished, state.blocks, enrollments)
    default:
      return []
  }
}

/** The plan whose snapshot says whether a track is throttled: never a paused (stale) one. */
function shownPlan(data: TodayData): StoredPlan | null {
  const { state } = data
  return state.kind === 'plan' || state.kind === 'resumed' ? state.plan : null
}

/** Active core items of the variant, and the introduced ones among them (decision 16). */
function coreProgress(
  catalog: PlanCatalog,
  enrollment: Enrollment,
  items: TodayData['items'],
): number {
  const roadmap = catalog.tracks[enrollment.trackId]?.roadmaps[enrollment.variant] ?? null
  if (roadmap === null) return 0
  const core = new Set(
    roadmap.weeks
      .flatMap((week) => coreItemsOfWeek(week, catalog))
      .filter((id) => isActiveItem(catalog, id)),
  )
  if (core.size === 0) return 0
  const introduced = [...core].filter((id) => items[id] !== undefined).length
  return introduced / core.size
}

function trackViews(data: TodayData): TrackProgressView[] {
  const { catalog, items, today } = data
  const plan = shownPlan(data)
  return data.enrollments
    .filter((enrollment) => enrollment.status === 'active')
    .map((enrollment) => {
      const { trackId } = enrollment
      const roadmap = catalog.tracks[trackId]?.roadmaps[enrollment.variant] ?? null
      const snapshot = plan?.tracks[trackId]
      const { title, accent } = trackInfo(trackId)
      return {
        trackId,
        title,
        accent,
        week: roadmapWeek(roadmap, catalog, items),
        weeks: roadmap === null ? 0 : weekSizes(roadmap, catalog).length,
        progress: coreProgress(catalog, enrollment, items),
        dueCount: dueQueue({ trackId, items, catalog, today, weakTopicIds: new Set() }).length,
        throttleMessage:
          snapshot?.throttled === true
            ? fill(copy.throttle.message, { n: formatNumber(snapshot.dueCount) })
            : null,
      }
    })
}

function weakTopicViews(data: TodayData): WeakTopicView[] {
  const active = new Set(
    data.enrollments.filter((entry) => entry.status === 'active').map((entry) => entry.trackId),
  )
  return weakTopics(data.items, data.catalog, active).map((topic) => ({
    trackId: topic.trackId,
    title: topicTitle(topic.trackId, topic.topicId),
    trackTitle: trackInfo(topic.trackId).title,
    count: topic.itemIds.length,
  }))
}

/** §5.7 streak over `daily_activity`; a date a schedule change skipped never breaks it. */
function streakOf(
  data: TodayData,
  dailyActivity: Readonly<Record<LocalDay, DailyActivity>>,
): number {
  const completedDays = new Set(
    Object.values(dailyActivity)
      .filter((day) => day.completed)
      .map((day) => day.localDay),
  )
  return streak({
    completedDays,
    today: data.today,
    skippedDays: scheduleSkippedDays(data.versions),
  })
}

/** `/today`'s view (task 5.1b): pure over its inputs and the track manifests. */
export function buildTodayPage(
  data: TodayData,
  dailyActivity: Readonly<Record<LocalDay, DailyActivity>>,
  requestId: string,
): TodayPage {
  return {
    data,
    blocks: stateBlocks(data),
    tracks: trackViews(data),
    streak: streakOf(data, dailyActivity),
    weakTopics: weakTopicViews(data),
    markSeenPlanId: data.state.kind === 'plan' ? data.state.plan.id : null,
    requestId,
  }
}
