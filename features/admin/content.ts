/**
 * `/admin/content` as data, and the content-coverage warning of `/admin` (platform design §0,
 * §2.4, §3.6; Part B-M5 decision 25; task 5.6). Pure: the generated catalog and the
 * `admin_track_positions()` rows come in — counts per track, variant and week, never a learner.
 */
import { itemHref } from '@/features/items/href'
import { isItemOfType } from '@/features/items/narrow'
import type { Catalog, CatalogItem, WeekCoverage } from '@/lib/content/catalog-types'
import type { ItemStatus, ItemType } from '@/lib/content/schemas/common'
import type { TrackManifest } from '@/lib/content/schemas/manifest'
import { variantLabel } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'

const copy = vi.adminOverview.content

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

/** A row of the drafts list: a link to the item's page (admins see drafts, §3.3). */
export type DraftEntry = {
  readonly id: string
  readonly title: string
  /** `en` for an English title (a LeetCode title, an English card front). */
  readonly titleLang: 'en' | 'vi' | undefined
  readonly meta: readonly string[]
  readonly href: string
}

export type Drafts = {
  readonly tracks: readonly { id: string; title: string; href: string }[]
  readonly items: readonly DraftEntry[]
  /** Draft notes of problems: a publish target of their own (`<itemId>#note`, §3.3). */
  readonly notes: readonly DraftEntry[]
}

export type ContentPage = {
  readonly tracks: readonly TrackContent[]
  readonly drafts: Drafts
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

function drafts(catalog: Catalog, trackTitle: (id: string) => string): Drafts {
  const items = Object.values(catalog.items).sort(byId)
  const entry = (item: CatalogItem, what: string, id = item.id): DraftEntry => ({
    id,
    title: item.title,
    titleLang: titleLang(item),
    meta: [trackTitle(item.trackId), what],
    href: itemHref(item),
  })
  return {
    tracks: catalog.tracks
      .filter((track) => track.status === 'draft')
      .map((track) => ({ id: track.id, title: track.title.vi, href: `/t/${track.id}` })),
    items: items
      .filter((item) => item.status === 'draft')
      .map((item) => entry(item, copy.stats.types[item.type])),
    notes: items.flatMap((item) =>
      isItemOfType(item, 'problem') && item.content.note?.status === 'draft'
        ? [entry(item, copy.drafts.note, item.content.note.mdxKey)]
        : [],
    ),
  }
}

/** Every track of the catalog with its stats and coverage, then the drafts. */
export function buildContentPage(
  catalog: Catalog,
  positions: readonly TrackPosition[],
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
    drafts: drafts(catalog, (id) => titles.get(id) ?? id),
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
