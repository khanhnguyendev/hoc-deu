/**
 * `/today` as data (platform design §2.4, §5.2, §5.5–§5.7; Part B-M5 task 5.1b): the blocks the
 * dashboard shows for each state, per-track progress, the streak, weak topics, and which plan the
 * browser marks seen. No React, no I/O: `ensureToday`'s `TodayData` and the `daily_activity` rows
 * come in; the track manifests (titles, accents, topic titles) are read from the generated
 * catalog, which the tests replace.
 */
import { itemHrefFromId } from '@/features/items/href'
import { trackProgressOf, type TrackProgressData } from '@/features/roadmap'
import { getTrack } from '@/lib/content/catalog'
import type { ItemMode } from '@/lib/domain/catalog'
import { checkInMinutes } from '@/lib/domain/plan/buildPlan'
import { extraTrackIds } from '@/lib/domain/plan/extra'
import { dueQueue } from '@/lib/domain/plan/queues'
import { eligibleTracks } from '@/lib/domain/plan/track'
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
  /** "Sửa": `/today?block=<blockId>` opens the check-in sheet (§2.4, task 5.2b). */
  readonly editHref: string
  /** `checkInMinutes(block)`: the minutes a new check-in pre-fills (decision 34 of M4). */
  readonly defaultMinutes: number
}

export type TrackProgressView = {
  readonly trackId: string
  readonly title: string
  readonly accent: string
  /** The roadmap week of weeks and the introduced core items of the enrolled variant — the track
   *  page's own `trackProgressOf` (m-1), so the two never disagree. */
  readonly progress: TrackProgressData
  /** Its due reviews now — 0 for a track the engine does not plan today (`countedTrackIds`). */
  readonly dueCount: number
  /** The enrollment's start date while it is after today ("Bắt đầu vào {date}"), else null. */
  readonly startsOn: LocalDay | null
  /** "Kế hoạch này được lập khi bạn có {n} thẻ cần ôn — tạm giảm thẻ mới." — the snapshot's own
   *  count — when the plan's snapshot says throttled (UI I-5); else null. */
  readonly throttleMessage: string | null
}

/** "Học thêm" for one track (decision 20): shown in the plan and resumed states. */
export type ExtraView = {
  readonly trackId: string
  readonly trackTitle: string
  readonly accent: string
  /** The shown plan's snapshot caps the track at 0 new items (§5.5): no "Học thêm" today. */
  readonly newPaused: boolean
}

export type WeakTopicView = {
  /** The topic's track: WeakAreas links to `/t/<trackId>`. */
  readonly trackId: string
  /** With `trackId`, the list key (two topics may share a title). */
  readonly topicId: string
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
  /** "Học thêm" per active, started track — plan and resumed states only (task 5.4). */
  readonly extra: readonly ExtraView[]
  /** The plan <MarkPlanSeen> marks: today's plan when the state is `plan`, else null. */
  readonly markSeenPlanId: string | null
  /** Per render (decision 16): the check-in and "Học thêm" forms derive event ids from it. */
  readonly requestId: string
  /** `?block=<id>` when the dashboard shows that block: its check-in sheet is open (§2.4). */
  readonly openBlockId: string | null
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

/** `/t/<track>/items/<local id>?block=<blockId>&mode=<mode>` (`itemHrefFromId`, m-2). */
function blockItemHref(itemId: string, blockId: string, mode: ItemMode): string {
  return itemHrefFromId(itemId, { block: blockId, mode })
}

/** `/today?block=<blockId>`: the block's check-in sheet (§2.4). */
function editHref(blockId: string): string {
  return `/today?${new URLSearchParams({ block: blockId }).toString()}`
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
      editHref: editHref(block.id),
      defaultMinutes: checkInMinutes(block),
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

/**
 * The tracks whose due items and weak topics `/today` counts: the plan engine's eligibility on
 * today (`eligibleTracks` — an active enrollment that has started, of an active catalog track), the
 * set `/review` draws its queue from (`reviewTrackIds`) and "Học thêm" is offered for
 * (`extraTrackIds`), so the three never disagree (UI I-2). A track re-added with a later start
 * date keeps its item states (§5.9) but counts nothing until it starts.
 */
function countedTrackIds(data: TodayData): ReadonlySet<string> {
  const { catalog, enrollments, today } = data
  return new Set(
    eligibleTracks({ planDate: today, catalog, enrollments }).map(
      (entry) => entry.enrollment.trackId,
    ),
  )
}

/**
 * A progress card per active enrollment — a track that has not started keeps its card with its
 * start date — whose due count is its `dueQueue` when the track counts today (`counted`), else 0.
 */
function trackViews(data: TodayData, counted: ReadonlySet<string>): TrackProgressView[] {
  const { catalog, items, today } = data
  const plan = shownPlan(data)
  return data.enrollments
    .filter((enrollment) => enrollment.status === 'active')
    .map((enrollment) => {
      const { trackId } = enrollment
      const snapshot = plan?.tracks[trackId]
      const { title, accent } = trackInfo(trackId)
      return {
        trackId,
        title,
        accent,
        progress: trackProgressOf(catalog, trackId, enrollment.variant, items),
        dueCount: counted.has(trackId)
          ? dueQueue({ trackId, items, catalog, today, weakTopicIds: new Set() }).length
          : 0,
        // LocalDay is a zero-padded `YYYY-MM-DD` string: string order is chronological order.
        startsOn: enrollment.startDate > today ? enrollment.startDate : null,
        throttleMessage:
          snapshot?.throttled === true
            ? fill(copy.throttle.message, { n: formatNumber(snapshot.dueCount) })
            : null,
      }
    })
}

/**
 * "Học thêm" (decision 20): one per track the engine would plan today (`extraTrackIds` — the
 * same eligibility the server applies, ruling M5-R33 M-4), on the plan the dashboard shows as
 * today's work (the plan and resumed states — never the paused view), paused when the snapshot
 * caps the track at 0 new items (the throttle banner says why, UI I-5).
 */
function extraViews(data: TodayData): ExtraView[] {
  const plan = shownPlan(data)
  if (plan === null) return []
  const { catalog, enrollments, today } = data
  return extraTrackIds({ planDate: today, catalog, enrollments }).map((trackId) => {
    const snapshot = Object.hasOwn(plan.tracks, trackId) ? plan.tracks[trackId] : undefined
    const { title, accent } = trackInfo(trackId)
    return {
      trackId,
      trackTitle: title,
      accent,
      newPaused: snapshot?.newPerDay === 0,
    }
  })
}

/** §5.7 weak topics of the tracks `/today` counts (`countedTrackIds`, as `/review`). */
function weakTopicViews(data: TodayData, counted: ReadonlySet<string>): WeakTopicView[] {
  return weakTopics(data.items, data.catalog, counted).map((topic) => ({
    trackId: topic.trackId,
    topicId: topic.topicId,
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

/**
 * `/today`'s view (tasks 5.1b, 5.2b, 5.4): pure over its inputs and the track manifests. `block` is
 * `?block=`: its sheet opens only for a block the dashboard shows — an unknown ID, or a finished
 * block of the paused plan, opens nothing.
 */
export function buildTodayPage(
  data: TodayData,
  dailyActivity: Readonly<Record<LocalDay, DailyActivity>>,
  requestId: string,
  block?: string,
): TodayPage {
  const blocks = stateBlocks(data)
  const counted = countedTrackIds(data)
  return {
    data,
    blocks,
    tracks: trackViews(data, counted),
    streak: streakOf(data, dailyActivity),
    weakTopics: weakTopicViews(data, counted),
    extra: extraViews(data),
    markSeenPlanId: data.state.kind === 'plan' ? data.state.plan.id : null,
    requestId,
    openBlockId: blocks.find((view) => view.block.id === block)?.block.id ?? null,
  }
}
