/**
 * `/admin/content` as data, and the content-coverage warning of `/admin` (platform design §0,
 * §2.4, §3.6; Part B-M5 decision 25; task 5.6). Pure: the generated catalog and the
 * `admin_track_positions()` rows come in — counts per track, variant and week, never a learner.
 */
import { itemHref } from '@/features/items/href'
import { isItemOfType } from '@/features/items/narrow'
import { OPS_TIMEZONE } from '@/lib/bot/ops-day'
import type { Catalog, CatalogItem, ProblemNote, WeekCoverage } from '@/lib/content/catalog-types'
import { NOTE_SUFFIX } from '@/lib/content/publish-targets'
import type { ItemStatus, ItemType } from '@/lib/content/schemas/common'
import type { TrackManifest } from '@/lib/content/schemas/manifest'
import { fill, formatDayTimeIn, variantLabel } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'

const copy = vi.adminOverview.content
const publishCopy = vi.publish

/**
 * Decision 25: a roadmap week is about seven study days, so the weeks an active learner reaches
 * within 14 days are those up to their current week plus two.
 */
export const HORIZON_WEEKS = 2

/** One `admin_track_positions()` row: `learners` active learners are in `week` of the variant. */
export type TrackPosition = {
  readonly trackId: string
  readonly variant: string
  readonly week: number
  readonly learners: number
}

/** The highest week of the variant's learners (plans of the last 14 days), plus two; or null. */
export function coverageHorizon(
  positions: readonly TrackPosition[],
  trackId: string,
  variant: string,
): number | null {
  const weeks = positions
    .filter((p) => p.trackId === trackId && p.variant === variant && p.learners > 0)
    .map((p) => p.week)
  return weeks.length === 0 ? null : Math.max(...weeks) + HORIZON_WEEKS
}

/** The coverage columns, in order; each shows only when the track lists its item type. */
export const COVERAGE_COLUMNS = ['lessons', 'notes', 'cards', 'exercises', 'prompts'] as const
export type CoverageColumn = (typeof COVERAGE_COLUMNS)[number]
const COLUMN_TYPE: Readonly<Record<CoverageColumn, ItemType>> = {
  lessons: 'lesson',
  notes: 'problem',
  cards: 'flashcard',
  exercises: 'exercise',
  prompts: 'prompt',
}

/**
 * `red`: a gap in a week an active learner reaches within 14 days (decision 25); `gap`: a gap
 * further ahead; `covered`: every topic lesson and every placed problem's note is there.
 */
export type CoverageState = 'red' | 'gap' | 'covered'

export type CoverageRow = {
  readonly week: number
  /** Active learners in this week now. */
  readonly learners: number
  /** Each week topic, by its title, and whether its pattern lesson exists (active). */
  readonly lessons: readonly { topic: string; title: string; present: boolean }[]
  readonly notedProblems: number
  readonly placedProblems: number
  readonly coreCards: number
  readonly extendedCards: number
  readonly exercises: number
  readonly prompts: number
  readonly state: CoverageState
}

export type RoadmapCoverage = {
  readonly trackTitle: string
  readonly variant: string
  /** `10 tuần` */
  readonly variantLabel: string
  readonly columns: readonly CoverageColumn[]
  /** null: the manifest lists the variant, its roadmap file does not exist yet (§3.6). */
  readonly rows: readonly CoverageRow[] | null
  /** The last week the red warning looks at; null without a learner in the last 14 days. */
  readonly horizon: number | null
  readonly maxLearnerWeek: number | null
}

export type TrackStats = {
  readonly trackTitle: string
  /** One row per item type the track lists, in the manifest's order. */
  readonly rows: readonly {
    type: ItemType
    label: string
    active: number
    draft: number
    retired: number
  }[]
  readonly total: number
  /** Problem notes by verification (§3.7); null when the track lists no problems. */
  readonly verification: { tested: number; compileOnly: number; noNote: number } | null
}

export type TrackContent = {
  readonly id: string
  readonly title: string
  readonly status: ItemStatus
  readonly statusLabel: string
  readonly stats: TrackStats
  readonly roadmaps: readonly RoadmapCoverage[]
}

/** A pull request link: `PR #41`. */
export type PullRequestLink = { readonly href: string; readonly label: string }

/** A draft's pending publish request (§6.6): its id ("Huỷ"), and its PR once a run set one. */
export type PendingPublish = { readonly requestId: number; readonly pr: PullRequestLink | null }

/**
 * A draft note's verification badge (§3.5, §3.7): `tested-by-bot` is ADR-0040's "tested (bot
 * tests)" — a bot-written note whose solution and tests the same bot wrote.
 */
export type DraftVerification = 'tested' | 'compile-only' | 'tested-by-bot'

/** A row of the drafts list: a link to the item's page (admins see drafts, §3.3). */
export type DraftEntry = {
  readonly id: string
  readonly title: string
  /** `en` for an English title (a LeetCode title, an English card front). */
  readonly titleLang: 'en' | 'vi' | undefined
  readonly meta: readonly string[]
  readonly href: string
  /**
   * The publish target (§6.6, task 6.7a): the item ID, or `<itemId>#note`. Without it (a draft
   * track), the row has no "Xuất bản".
   */
  readonly target?: string
  /** Which publish checklist the dialog shows: a problem or note's (§6.6), or any other item's. */
  readonly checklist?: 'problem' | 'item'
  /** A draft note's verification badge; null for an item. */
  readonly verification?: DraftVerification | null
  /** The pending publish request for the target, or null. */
  readonly request?: PendingPublish | null
}

/** One `content_publish_requests` row as admins read it (RLS: admins only, §4.2). */
export type PublishRequestRow = {
  readonly id: number
  readonly target: string
  readonly status: 'pending' | 'merged' | 'cancelled'
  readonly prUrl: string | null
  /** ISO-8601 instant. */
  readonly requestedAt: string
}

/** A row of the "Yêu cầu xuất bản" section. */
export type PublishRequestView = {
  readonly id: number
  readonly target: string
  /** The item's title, or the target when the deployed catalog no longer has it. */
  readonly title: string
  readonly titleLang: 'en' | 'vi' | undefined
  /** `Ghi chú` for a note, the item type's label otherwise; null for an unknown target. */
  readonly kind: string | null
  readonly href: string | null
  readonly status: PublishRequestRow['status']
  readonly statusLabel: string
  readonly pr: PullRequestLink | null
  /** `09:00, 2 tháng 10, 2026` (Asia/Ho_Chi_Minh). */
  readonly requestedAt: string
}

/** Pending and recent requests; `error` when they could not be read (the page still renders). */
export type PublishRequestsView =
  | { readonly state: 'ready'; readonly rows: readonly PublishRequestView[] }
  | { readonly state: 'empty' }
  | { readonly state: 'error' }

export type Drafts = {
  readonly tracks: readonly { id: string; title: string; href: string }[]
  readonly items: readonly DraftEntry[]
  /** Draft notes of problems: a publish target of their own (`<itemId>#note`, §3.3). */
  readonly notes: readonly DraftEntry[]
}

export type ContentPage = {
  readonly tracks: readonly TrackContent[]
  readonly drafts: Drafts
  /** The "Yêu cầu xuất bản" section (§2.4, §6.6; task 6.7a). */
  readonly publishRequests: PublishRequestsView
  /** Red weeks over every track and variant (the `/admin` link's summary). */
  readonly redWeeks: number
}

/** The red warning of `/admin`: a track variant and its red weeks. */
export type CoverageWarning = {
  readonly trackId: string
  readonly trackTitle: string
  readonly variant: string
  readonly weeks: readonly number[]
}

const byId = (a: { id: string }, b: { id: string }): number =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0

/**
 * A week's gaps that decision 25 counts — only for the types the track lists: a topic without its
 * pattern lesson (English has topics but no lessons) and a placed problem without a note.
 */
function hasGap(week: WeekCoverage, listed: ReadonlySet<ItemType>): boolean {
  const missingLesson =
    listed.has('lesson') && week.lessons.some((lesson) => lesson.lessonId === null)
  const unnoted = listed.has('problem') && week.notedProblems < week.placedProblems
  return missingLesson || unnoted
}

function coverageRows(
  track: TrackManifest,
  weeks: readonly WeekCoverage[],
  positions: readonly TrackPosition[],
  variant: string,
): CoverageRow[] {
  const listed = new Set<ItemType>(track.itemTypes)
  const horizon = coverageHorizon(positions, track.id, variant)
  const topicTitle = (id: string) => track.topics.find((topic) => topic.id === id)?.title.vi ?? id
  return weeks.map((week) => {
    const gap = hasGap(week, listed)
    return {
      week: week.week,
      learners: positions
        .filter((p) => p.trackId === track.id && p.variant === variant && p.week === week.week)
        .reduce((sum, p) => sum + p.learners, 0),
      lessons: week.lessons.map((lesson) => ({
        topic: lesson.topic,
        title: topicTitle(lesson.topic),
        present: lesson.lessonId !== null,
      })),
      notedProblems: week.notedProblems,
      placedProblems: week.placedProblems,
      coreCards: week.coreCards,
      extendedCards: week.extendedCards,
      exercises: week.exercises,
      prompts: week.prompts,
      state: !gap ? 'covered' : horizon !== null && week.week <= horizon ? 'red' : 'gap',
    }
  })
}

function roadmapCoverage(
  catalog: Catalog,
  track: TrackManifest,
  variant: string,
  positions: readonly TrackPosition[],
): RoadmapCoverage {
  const weeks = catalog.coverage[track.id]?.[variant]
  const horizon = coverageHorizon(positions, track.id, variant)
  return {
    trackTitle: track.title.vi,
    variant,
    variantLabel: variantLabel(variant),
    columns: COVERAGE_COLUMNS.filter((column) => track.itemTypes.includes(COLUMN_TYPE[column])),
    rows: weeks === undefined ? null : coverageRows(track, weeks, positions, variant),
    horizon,
    maxLearnerWeek: horizon === null ? null : horizon - HORIZON_WEEKS,
  }
}

const STATUSES: readonly ItemStatus[] = ['active', 'draft', 'retired']

function catalogStats(track: TrackManifest, items: readonly CatalogItem[]): TrackStats {
  const count = (type: ItemType, status: ItemStatus) =>
    items.filter((item) => item.type === type && item.status === status).length
  const rows = track.itemTypes.map((type) => ({
    type,
    label: copy.stats.types[type],
    ...(Object.fromEntries(STATUSES.map((status) => [status, count(type, status)])) as Record<
      ItemStatus,
      number
    >),
  }))
  // Every problem of the track, as the content:build report counts them (§3.6).
  const notes = items.flatMap((item) => (isItemOfType(item, 'problem') ? [item.content.note] : []))
  return {
    trackTitle: track.title.vi,
    rows,
    total: items.length,
    verification: track.itemTypes.includes('problem')
      ? {
          tested: notes.filter((note) => note?.verification === 'tested').length,
          compileOnly: notes.filter((note) => note?.verification === 'compile-only').length,
          noNote: notes.filter((note) => note === null).length,
        }
      : null,
  }
}

/** A LeetCode title and an English card front are English; other titles are Vietnamese. */
function titleLang(item: CatalogItem): 'en' | 'vi' | undefined {
  if (isItemOfType(item, 'problem')) return 'en'
  if (isItemOfType(item, 'flashcard')) return item.content.lang.front
  return undefined
}

const PR_NUMBER = /\/pull\/([1-9][0-9]*)$/

function pullRequest(url: string | null): PullRequestLink | null {
  if (url === null) return null
  const number = PR_NUMBER.exec(url)?.[1]
  return { href: url, label: number === undefined ? url : fill(publishCopy.prLabel, { number }) }
}

/** ADR-0040: a bot-written note that passed its (bot-written) tests is "tested (bot tests)". */
function noteVerification(note: ProblemNote): DraftVerification {
  return note.verification === 'tested' && note.origin === 'bot'
    ? 'tested-by-bot'
    : note.verification
}

function drafts(
  catalog: Catalog,
  trackTitle: (id: string) => string,
  requests: readonly PublishRequestRow[],
): Drafts {
  const items = Object.values(catalog.items).sort(byId)
  const pending = new Map(
    requests
      .filter((request) => request.status === 'pending')
      .map((request) => [
        request.target,
        { requestId: request.id, pr: pullRequest(request.prUrl) } satisfies PendingPublish,
      ]),
  )
  const entry = (
    item: CatalogItem,
    what: string,
    id: string,
    verification: DraftVerification | null,
  ): DraftEntry => ({
    id,
    title: item.title,
    titleLang: titleLang(item),
    meta: [trackTitle(item.trackId), what],
    href: itemHref(item),
    target: id,
    checklist: isItemOfType(item, 'problem') ? 'problem' : 'item',
    verification,
    request: pending.get(id) ?? null,
  })
  return {
    tracks: catalog.tracks
      .filter((track) => track.status === 'draft')
      .map((track) => ({ id: track.id, title: track.title.vi, href: `/t/${track.id}` })),
    items: items
      .filter((item) => item.status === 'draft')
      .map((item) => entry(item, copy.stats.types[item.type], item.id, null)),
    notes: items.flatMap((item) =>
      isItemOfType(item, 'problem') && item.content.note?.status === 'draft'
        ? [
            entry(
              item,
              copy.drafts.note,
              item.content.note.mdxKey,
              noteVerification(item.content.note),
            ),
          ]
        : [],
    ),
  }
}

/** Pending first, then the others; newest first within each (then by id). */
function requestOrder(a: PublishRequestRow, b: PublishRequestRow): number {
  const pendingFirst = Number(b.status === 'pending') - Number(a.status === 'pending')
  return pendingFirst || b.requestedAt.localeCompare(a.requestedAt) || b.id - a.id
}

function publishRequestsView(
  catalog: Catalog,
  requests: readonly PublishRequestRow[] | null,
): PublishRequestsView {
  if (requests === null) return { state: 'error' }
  if (requests.length === 0) return { state: 'empty' }
  const rows = [...requests].sort(requestOrder).map((request): PublishRequestView => {
    const isNote = request.target.endsWith(NOTE_SUFFIX)
    const itemId = isNote ? request.target.slice(0, -NOTE_SUFFIX.length) : request.target
    const item = Object.hasOwn(catalog.items, itemId) ? catalog.items[itemId] : undefined
    return {
      id: request.id,
      target: request.target,
      title: item?.title ?? request.target,
      titleLang: item === undefined ? undefined : titleLang(item),
      kind: item === undefined ? null : isNote ? copy.drafts.note : copy.stats.types[item.type],
      href: item === undefined ? null : itemHref(item),
      status: request.status,
      statusLabel: publishCopy.requests.status[request.status],
      pr: pullRequest(request.prUrl),
      requestedAt: fill(
        publishCopy.requests.at,
        formatDayTimeIn(request.requestedAt, OPS_TIMEZONE),
      ),
    }
  })
  return { state: 'ready', rows }
}

/**
 * Every track of the catalog with its stats and coverage, then the drafts with their publish
 * state, and the publish requests (`null`: they could not be read).
 */
export function buildContentPage(
  catalog: Catalog,
  positions: readonly TrackPosition[],
  requests: readonly PublishRequestRow[] | null = [],
): ContentPage {
  const allItems = Object.values(catalog.items)
  const tracks = catalog.tracks.map((track) => ({
    id: track.id,
    title: track.title.vi,
    status: track.status,
    statusLabel: copy.trackStatus[track.status],
    stats: catalogStats(
      track,
      allItems.filter((item) => item.trackId === track.id),
    ),
    roadmaps: track.roadmaps.map((ref) => roadmapCoverage(catalog, track, ref.id, positions)),
  }))
  const titles = new Map(catalog.tracks.map((track) => [track.id, track.title.vi]))
  return {
    tracks,
    drafts: drafts(catalog, (id) => titles.get(id) ?? id, requests ?? []),
    publishRequests: publishRequestsView(catalog, requests),
    redWeeks: tracks
      .flatMap((track) => track.roadmaps)
      .reduce((sum, roadmap) => sum + redWeeksOf(roadmap).length, 0),
  }
}

const redWeeksOf = (roadmap: RoadmapCoverage): number[] =>
  (roadmap.rows ?? []).filter((row) => row.state === 'red').map((row) => row.week)

/** The `/admin` red warning: each track variant with red weeks (decision 25). */
export function coverageWarnings(
  catalog: Catalog,
  positions: readonly TrackPosition[],
): CoverageWarning[] {
  return catalog.tracks.flatMap((track) =>
    track.roadmaps.flatMap((ref) => {
      const weeks = redWeeksOf(roadmapCoverage(catalog, track, ref.id, positions))
      return weeks.length === 0
        ? []
        : [{ trackId: track.id, trackTitle: track.title.vi, variant: ref.id, weeks }]
    }),
  )
}
