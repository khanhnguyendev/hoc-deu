/**
 * The loaders of `/tracks`, `/t/[trackId]` and `/t/[trackId]/items/[itemId]` (platform design §2.4,
 * §3.4, §3.8; task 3.4b). Every loader starts with `await requireOnboarded()`; the track list comes
 * from the generated catalog (decision 6) and the learner's enrollments from `user_tracks` through
 * the session client (own rows, RLS). Drafts are for admins; retired content is kept for history.
 */
import 'server-only'
import { cache } from 'react'
import { itemIdFromRoute } from '@/features/items/href'
import { isDue, resolveMode, type OutcomeContext } from '@/features/items/outcome'
import { MOCK_INTERVIEW_TAG } from '@/features/items/prompt/tag'
import type { ItemLink, ItemStateView, ItemViewer } from '@/features/items/types'
import { requireOnboarded, type SessionUser } from '@/lib/auth/dal'
import { catalogAccess } from '@/lib/content/catalog'
import type { CatalogItem } from '@/lib/content/catalog-types'
import { own } from '@/lib/domain/compare'
import { blocksWithItem } from '@/lib/domain/plan/checkin'
import { mockInterviewProblem } from '@/lib/domain/plan/practice'
import type { ItemState } from '@/lib/domain/state'
import { loadItemStates } from '@/lib/events/load-derived'
import { vi } from '@/lib/i18n/vi'
import { planCatalog } from '@/lib/plans/catalog'
import { currentPlan } from '@/lib/plans/current'
import {
  readEnrollments as readPlanEnrollments,
  readItemStates,
  readScheduleVersions,
  todayOf,
} from '@/lib/plans/reads'
import type { ItemStatus } from '@/lib/content/schemas/common'
import type { TrackManifest } from '@/lib/content/schemas/manifest'
import {
  describeThrottle,
  describeWeeklyTemplate,
  type TemplateDay,
} from '@/lib/content/weekly-template'
import { defaultVariant } from '@/lib/domain/plan/variant'
import { variantLabel } from '@/lib/i18n/format'
import { createClient } from '@/lib/supabase/server'
import { buildRoadmapView, resolveItemLink, TRACKS_HREF, type RoadmapView } from './view-model'

export type TrackSummary = {
  id: string
  /** The Vietnamese title. */
  title: string
  /** The English title (shown in `lang="en"`). */
  titleEn: string
  /** `track-1`…`track-8`, for `data-accent`. */
  accent: string
  status: ItemStatus
}

export type Enrollment = {
  status: 'active' | 'paused' | 'removed'
  roadmapVariant: string
  budgetMinutes: number
}

export type TracksOverview = {
  isAdmin: boolean
  /** Active and paused enrollments, in catalog order — a retired track included. */
  mine: { track: TrackSummary; enrollment: Enrollment }[]
  /** Active tracks not enrolled (or removed); drafts too for admins. */
  others: TrackSummary[]
}

export type VariantLink = { id: string; label: string; href: string; current: boolean }

export type TrackPageData = {
  track: TrackSummary
  /** The learner's active or paused enrollment; null when not enrolled (or removed). */
  enrollment: Enrollment | null
  template: TemplateDay[]
  throttle: string[]
  variants: VariantLink[]
  /** Null when the variant's roadmap file does not exist yet (decision 4). */
  view: RoadmapView | null
  isAdmin: boolean
}

export type ItemPageModel = {
  item: CatalogItem
  track: TrackSummary
  viewer: ItemViewer
  backHref: string
  resolveItem: (id: string) => ItemLink | null
  /** The learner's state for the item; null before any result, and on a read-only page. */
  state: ItemStateView | null
  /**
   * The result controls' context (task 5.2c): the resolved mode, the plan context, the state and
   * a per-render request id — the route adds `record` (the server action, unbound). Null when the
   * page is read-only: a draft an admin previews, a retired item, an item of a track that is not
   * active.
   */
  outcome: OutcomeContext | null
  /** The mock-interview prompt only (§5.6): the problem `mockInterviewProblem` picks, or null. */
  mockInterviewProblem?: ItemLink | null
}

const ENROLLMENT_STATUSES: readonly Enrollment['status'][] = ['active', 'paused', 'removed']

type SessionClient = Awaited<ReturnType<typeof createClient>>

function summaryOf(track: TrackManifest): TrackSummary {
  return {
    id: track.id,
    title: track.title.vi,
    titleEn: track.title.en,
    accent: track.accent,
    status: track.status,
  }
}

/**
 * The learner's own `user_tracks` rows by track ID — of one track when `trackId` is given. No guard
 * of its own: only the guarded loaders below call it, with the signed-in user's client and id.
 */
async function readEnrollments(
  supabase: SessionClient,
  userId: string,
  trackId?: string,
): Promise<Map<string, Enrollment>> {
  let query = supabase
    .from('user_tracks')
    .select('track_id, status, roadmap_variant, budget_minutes')
    .eq('user_id', userId)
  if (trackId !== undefined) query = query.eq('track_id', trackId)
  const { data, error } = await query
  if (error) throw new Error('Could not read the enrolled tracks', { cause: error })
  return new Map(
    data.map((row) => [
      row.track_id,
      {
        // The check constraint allows exactly these; anything else reads as removed (not shown).
        status: ENROLLMENT_STATUSES.find((status) => status === row.status) ?? 'removed',
        roadmapVariant: row.roadmap_variant,
        budgetMinutes: row.budget_minutes,
      },
    ]),
  )
}

/** An active or paused enrollment; a removed one is no enrollment. */
const followed = (enrollment: Enrollment | undefined): enrollment is Enrollment =>
  enrollment !== undefined && enrollment.status !== 'removed'

/**
 * `/tracks` (§2.4): the learner's tracks (active and paused enrollments) and the other tracks they
 * could add — active ones, plus drafts for admins. Retired tracks show only to their learners.
 */
export async function getTracksOverview(): Promise<TracksOverview> {
  const user = await requireOnboarded()
  const supabase = await createClient()
  const enrollments = await readEnrollments(supabase, user.id)
  const mine: TracksOverview['mine'] = []
  const others: TrackSummary[] = []
  for (const track of catalogAccess.catalog.tracks) {
    if (track.status === 'draft' && !user.isAdmin) continue
    const enrollment = enrollments.get(track.id)
    if (followed(enrollment)) mine.push({ track: summaryOf(track), enrollment })
    else if (track.status !== 'retired') others.push(summaryOf(track))
  }
  return { isAdmin: user.isAdmin, mine, others }
}

/**
 * `/t/[trackId]` (§2.4): the track, the learner's enrollment, its weekly template, the roadmap
 * variants and the chosen variant's roadmap. Null (→ 404) for an unknown track, a draft track for
 * a learner, and a retired track the learner does not follow. The variant is the parameter when
 * the manifest lists it, else the enrolled one, else `defaultVariant` at the track's default
 * budget (2.9). Wrapped in `cache()`: `generateMetadata` and the page share one read.
 */
export const getTrackPage = cache(
  async (trackId: string, variant: string | undefined): Promise<TrackPageData | null> => {
    const user = await requireOnboarded()
    const track = catalogAccess.getTrack(trackId)
    if (track === null || (track.status === 'draft' && !user.isAdmin)) return null

    const supabase = await createClient()
    const row = (await readEnrollments(supabase, user.id, track.id)).get(track.id)
    const enrollment = followed(row) ? row : null
    if (track.status === 'retired' && enrollment === null && !user.isAdmin) return null

    const listed = (id: string | undefined): id is string =>
      id !== undefined && track.roadmaps.some((roadmap) => roadmap.id === id)
    const enrolled = enrollment?.roadmapVariant
    const current = listed(variant)
      ? variant
      : listed(enrolled)
        ? enrolled
        : defaultVariant(track.roadmaps, track.defaults.budgetMinutes)
    const roadmap = catalogAccess.getRoadmap(track.id, current)

    return {
      track: summaryOf(track),
      enrollment,
      template: describeWeeklyTemplate(track.weeklyTemplate),
      throttle: describeThrottle(track.defaults),
      variants: track.roadmaps.map(({ id }) => ({
        id,
        label: variantLabel(id),
        href: `/t/${track.id}?variant=${encodeURIComponent(id)}`,
        current: id === current,
      })),
      view:
        roadmap === null
          ? null
          : buildRoadmapView({
              track,
              roadmap,
              access: catalogAccess,
              includeDrafts: user.isAdmin,
            }),
      isAdmin: user.isAdmin,
    }
  },
)

type ReadOnly = Pick<ItemPageModel, 'state' | 'outcome'>
const READ_ONLY: ReadOnly = { state: null, outcome: null }

const stateView = (state: ItemState): ItemStateView => ({
  status: state.status,
  level: state.level,
  dueOn: state.dueOn,
})

/**
 * The learner's side of an item page (task 5.2c; decisions 13, 14, 16): today from the schedule,
 * the plan check-ins and results go to (`currentPlan`, active tracks only — M-5 A), the item's own
 * state (one row; every row — paged — only for the mock-interview prompt, whose problem pick reads
 * them all), the block that lists the item (`?block=` chooses among several, else the first), the
 * mode (`resolveMode`) and a fresh request id. Only for an active item of an active track that the
 * engine's catalog knows; anything else is read-only. No guard of its own: `getItemPage` calls it
 * after `requireOnboarded`, with the signed-in user.
 */
async function learnerContext(
  user: SessionUser,
  item: CatalogItem,
  trackActive: boolean,
  query: { readonly block: string | undefined; readonly mode: string | undefined },
): Promise<Pick<ItemPageModel, 'state' | 'outcome' | 'mockInterviewProblem'>> {
  const catalog = planCatalog()
  const planItem = own(catalog.items, item.id)
  if (!trackActive || item.status !== 'active' || planItem === undefined) return READ_ONLY

  const mockInterview = planItem.tag === MOCK_INTERVIEW_TAG
  const supabase = await createClient()
  const [versions, enrollments, items] = await Promise.all([
    readScheduleVersions(supabase, user.id),
    readPlanEnrollments(supabase, user.id, catalog),
    mockInterview
      ? readItemStates(supabase, user.id)
      : loadItemStates(supabase, user.id, [item.id]),
  ])
  const today = todayOf(versions, new Date())
  const active = new Set(
    enrollments
      .filter((enrollment) => enrollment.status === 'active')
      .map((enrollment) => enrollment.trackId),
  )
  const current = await currentPlan(supabase, user.id, today, active)
  const blocks = current === null ? [] : blocksWithItem(current.plan, item.id)
  const block = blocks.find((candidate) => candidate.id === query.block) ?? blocks[0]
  const planMode = block?.items.find((entry) => entry.itemId === item.id)?.mode ?? null
  const itemState = own(items, item.id) ?? null
  const state = itemState === null ? null : stateView(itemState)
  const label = current?.kind === 'today' ? vi.outcomes.plan.today : vi.outcomes.plan.earlier

  return {
    state,
    outcome: {
      mode: resolveMode({
        item: planItem,
        requested: query.mode,
        planMode,
        state: itemState,
        today,
      }),
      plan: block === undefined ? null : { blockId: block.id, label },
      state,
      due: itemState !== null && isDue(planItem, itemState, today),
      requestId: crypto.randomUUID(),
      itemId: item.id,
      ...(block !== undefined && { blockId: block.id }),
    },
    ...(mockInterview && { mockInterviewProblem: mockInterviewLink(user, item, items) }),
  }
}

/** The problem `mockInterviewProblem` picks for the mock interview (§5.6), as a link; or null. */
function mockInterviewLink(
  user: SessionUser,
  item: CatalogItem,
  items: Readonly<Record<string, ItemState>>,
): ItemLink | null {
  const pick = mockInterviewProblem({ trackId: item.trackId, items, catalog: planCatalog() })
  return pick === null ? null : resolveItemLink(catalogAccess, pick, user.isAdmin)
}

/**
 * `/t/[trackId]/items/[itemId]` (§2.4, decision 24): the item for the route's parameters (the
 * local ID is decoded — derived IDs hold colons), its track, who is looking and the links it may
 * resolve. Null (→ 404) for an unknown item or track, and for a draft item or an item of a draft
 * track when a learner asks; retired items stay viewable (their page shows the notice), and link
 * back to `/tracks` when their retired track's page would be a 404. The page loads the item's MDX
 * and code itself (`renderItemPage`). Task 5.2c adds the learner's side (`learnerContext`): the
 * state, the result controls' context — `block` and `mode` are the route's `?block=` and `?mode=` —
 * and, for the mock-interview prompt, its problem. Wrapped in `cache()` like `getTrackPage`: the
 * route's `generateMetadata` and page pass the same primitive arguments and share one read (and
 * one request id).
 */
export const getItemPage = cache(
  async (
    trackId: string,
    itemParam: string,
    block?: string,
    mode?: string,
  ): Promise<ItemPageModel | null> => {
    const user = await requireOnboarded()
    const track = catalogAccess.getTrack(trackId)
    if (track === null || (track.status === 'draft' && !user.isAdmin)) return null
    const item = catalogAccess.getItem(itemIdFromRoute(trackId, itemParam))
    if (item === null || item.trackId !== track.id) return null
    if (item.status === 'draft' && !user.isAdmin) return null

    // A retired track's page is a 404 for a learner who does not follow it (`getTrackPage`), so its
    // items link back to the track list instead. Only then is the enrollment read.
    let backHref = `/t/${track.id}`
    if (track.status === 'retired' && !user.isAdmin) {
      const supabase = await createClient()
      const row = (await readEnrollments(supabase, user.id, track.id)).get(track.id)
      if (!followed(row)) backHref = TRACKS_HREF
    }

    const learner = await learnerContext(user, item, track.status === 'active', { block, mode })
    return {
      item,
      track: summaryOf(track),
      ...learner,
      viewer: {
        // A learner without a code language (English only) still gets a solution tab order.
        codeLanguage: user.codeLanguage ?? track.codeLanguages?.[0] ?? 'python',
        isAdmin: user.isAdmin,
      },
      backHref,
      resolveItem: (id) => resolveItemLink(catalogAccess, id, user.isAdmin),
    }
  },
)
