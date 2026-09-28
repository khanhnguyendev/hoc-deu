/**
 * One learner's day for the bot (platform design §6.3, §6.4.2, §5.2–§5.5, §5.12; Part B-M6
 * decisions 6, 9, 15, 32, 37; task 6.4b): `loadUserDay` reads it once with the secret-key client
 * (`lib/plans/day.ts` and `lib/plans/reads.ts`, whose reads all filter by `user_id` — never
 * `lib/plans`' entry points, which assert the session user); `allowanceOf` is what `PUT …/plan`
 * (6.5b) validates a proposed plan against (`validateAiPlan`, 6.5a); `buildContext` is the §6.4.2
 * answer — pseudonymised and allow-listed: it is parsed with the strict `contextResponse` before
 * it leaves, so nothing outside the contract (no name, e-mail, avatar, user id, `bot_ref`, event
 * or plan id) can. The only learner text is `untrusted.notes`, sanitised, and only when the
 * learner shares notes (decision 32).
 *
 * Tracks (decision 9): those in the baseline build's snapshots — active enrollments that have
 * started, on an active catalog track. Task 6.6c fills `overrides` (those `planContext` reads —
 * AI flag on, status active, computed-active today — with their computed expiry),
 * `constraints.overrides.remainingActive` (per track: the limit less the ones in force) and the
 * day's `insert_block`s at the head of `templateToday`. An extra week's used days count the plans
 * before today (`readOverrides`), so on its last study day the context still lists it while SQL's
 * count — today's plan included — may already call it expired: `remainingActive` is then one lower
 * than SQL's room (conservative). Server-only; nothing a learner wrote is logged.
 */
import 'server-only'
import { contextResponse, CONTEXT_LIMITS, MAX_PLANNED_MINUTES_RULE } from './contract/context'
import type { BotContext } from './contract/context'
import { sanitizeNote } from './notes'
import type { RunUser } from './runs'
import { readBotSettings } from './settings'
import type { PlanCatalog, PlanRoadmap, PlanTemplateBlock, PlanTrack } from '@/lib/domain/catalog'
import { compareIds, own } from '@/lib/domain/compare'
import type { AiPlanAllowance } from '@/lib/domain/plan/ai'
import { buildPlan } from '@/lib/domain/plan/buildPlan'
import {
  activeOverrides,
  effectiveRoadmap,
  insertBlocksOn,
  reorderable,
  TOPIC_PRACTICE_TAG,
  upcomingTopics,
} from '@/lib/domain/plan/overrides'
import { compareDueEntries, type DueEntry, dueQueue } from '@/lib/domain/plan/queues'
import { newQueue } from '@/lib/domain/plan/roadmap'
import { dayTemplate } from '@/lib/domain/plan/template'
import {
  BLOCK_KINDS,
  type BlockKind,
  type DayPlan,
  type Enrollment,
  type PlanContext,
  type StoredPlan,
  type TrackSnapshot,
} from '@/lib/domain/plan/types'
import type { BlockState } from '@/lib/domain/state'
import { weakTopics } from '@/lib/domain/stats/weakTopics'
import { addDays, type LocalDay } from '@/lib/domain/time/localDay'
import { weekdayOf } from '@/lib/domain/time/weekday'
import { loadDay, planContext, resolveDay, type Day, type Resolution } from '@/lib/plans/day'
import { readBlockStates, readDailyActivity } from '@/lib/plans/reads'
import { createAdminClient } from '@/lib/supabase/admin'

type Admin = ReturnType<typeof createAdminClient>

/** Everything the context and the write validations need, read once with the secret-key client. */
export type UserDay = {
  readonly day: Day
  /** The day resolved as `/today` would (`resolveDay`): 6.5b re-checks the gate with it. */
  readonly resolution: Resolution
  /** Today's stored plan (null: none, or a row that cannot be read). */
  readonly plan: StoredPlan | null
  /** The check-ins of today's stored row, keyed by blockKey. */
  readonly blocks: Readonly<Record<string, BlockState>>
  readonly context: PlanContext
  /** `buildPlan(context)` — what `/today` would build now (decision 15: its snapshots). */
  readonly baseline: DayPlan
  /** Decision 9: `closed` for the `paused` and `resumed` resolutions. */
  readonly gate: 'open' | 'closed'
}

/** One read of the learner's day at `now` (the secret-key client; every read filters `userId`). */
export async function loadUserDay(userId: string, now: Date): Promise<UserDay> {
  const admin = createAdminClient()
  const day = await loadDay(admin, userId, now)
  const [resolution, context] = await Promise.all([
    resolveDay(admin, userId, day),
    planContext(admin, userId, day),
  ])
  const today = resolution.kind === 'today' ? resolution.read : null
  return {
    day,
    resolution,
    plan: today?.plan ?? null,
    blocks: today === null ? {} : await readBlockStates(admin, [today.row.id]),
    context,
    baseline: buildPlan(context),
    gate: resolution.kind === 'paused' || resolution.kind === 'resumed' ? 'closed' : 'open',
  }
}

// ---------------------------------------------------------------------------------------------
// The day's facts, shared by the allowance and the context
// ---------------------------------------------------------------------------------------------

export type TrackFacts = {
  readonly trackId: string
  readonly enrollment: Enrollment
  readonly track: PlanTrack
  readonly snapshot: TrackSnapshot
  /** The variant's roadmap as the learner has it (null: the variant has no roadmap file). */
  readonly roadmap: PlanRoadmap | null
  /** The effective roadmap (§5.12: the active reorders applied). */
  readonly effective: PlanRoadmap | null
  readonly overrides: ReturnType<typeof activeOverrides>
  readonly weakTopicIds: ReadonlySet<string>
  readonly due: readonly DueEntry[]
  /** The first `newQueueHeadPerTrack` items of the new-item queue (§5.3). */
  readonly head: readonly string[]
  /** Decision 37: `head` cut to the effective cap's new SRS items; empty during an extra week. */
  readonly allowedNew: readonly string[]
}

export type DayFacts = {
  readonly tracks: readonly TrackFacts[]
  /** Every track's due entries in the due queue's order (Weak first, §5.4 step 3). */
  readonly due: readonly DueEntry[]
  /** Due first, then every other introduced, not mastered item of the tracks (by ID). */
  readonly allowedReview: readonly string[]
  /** Active deep-dive lessons of the tracks the learner has not completed (by ID). */
  readonly openDeepDives: readonly string[]
}

/** Compared by equality only, as `lib/domain/plan/ai.ts` does: a plain lesson is never reviewed. */
const LESSON_TYPE = 'lesson'

const isSrs = (catalog: PlanCatalog, itemId: string) =>
  (own(catalog.items, itemId)?.srs ?? null) !== null

/** Decision 37: the head's prefix holding at most `cap` new SRS items (null: no cap); nothing
 *  during an extra week — the roadmap never moves faster than the baseline. */
function cutHead(
  head: readonly string[],
  catalog: PlanCatalog,
  cap: number | null,
  extraWeek: boolean,
): string[] {
  if (extraWeek) return []
  if (cap === null) return [...head]
  const allowed: string[] = []
  let srs = 0
  for (const itemId of head) {
    if (isSrs(catalog, itemId)) {
      if (srs === cap) break
      srs += 1
    }
    allowed.push(itemId)
  }
  return allowed
}

function trackFacts(u: UserDay, trackId: string, snapshot: TrackSnapshot): TrackFacts | null {
  const { catalog, items } = u.context
  const today = u.context.planDate
  const enrollment = u.context.enrollments.find(
    (candidate) => candidate.trackId === trackId && candidate.status === 'active',
  )
  const track = own(catalog.tracks, trackId)
  if (enrollment === undefined || track === undefined) return null
  const overrides = activeOverrides(u.context.overrides ?? [], trackId, today)
  const roadmap = own(track.roadmaps, enrollment.variant) ?? null
  const effective =
    roadmap === null ? null : effectiveRoadmap(roadmap, track, overrides, catalog, items)
  const weakTopicIds = new Set(
    weakTopics(items, catalog, new Set([trackId])).map((topic) => topic.topicId),
  )
  const due = dueQueue({ trackId, items, catalog, today, weakTopicIds })
  const head = newQueue({
    trackId,
    roadmap: effective,
    catalog,
    items,
    includeBonus: enrollment.includeBonus,
  }).slice(0, CONTEXT_LIMITS.newQueueHeadPerTrack)
  return {
    trackId,
    enrollment,
    track,
    snapshot,
    roadmap,
    effective,
    overrides,
    weakTopicIds,
    due,
    head,
    allowedNew: cutHead(head, catalog, snapshot.newPerDay, snapshot.extraWeek !== undefined),
  }
}

/** The facts the allowance and the context read (exported for the engine parity tests). */
export function dayFacts(u: UserDay): DayFacts {
  const { catalog, items } = u.context
  const tracks = Object.entries(u.baseline.tracks)
    .toSorted(([a], [b]) => compareIds(a, b))
    .flatMap(([trackId, snapshot]) => trackFacts(u, trackId, snapshot) ?? [])
  const trackIds = new Set(tracks.map((facts) => facts.trackId))
  const weakOf = new Map(tracks.map((facts) => [facts.trackId, facts.weakTopicIds]))
  // Topic ids are unique only within a track: each entry is checked against its own track's.
  const due = tracks
    .flatMap((facts) => facts.due)
    .toSorted(
      compareDueEntries(
        (entry) =>
          entry.item.topicId !== null &&
          (weakOf.get(entry.item.trackId)?.has(entry.item.topicId) ?? false),
      ),
    )
  const listed = new Set(due.map((entry) => entry.itemId))
  const introduced = Object.values(items)
    .filter((state) => {
      const item = own(catalog.items, state.itemId)
      return (
        trackIds.has(state.trackId) &&
        state.status !== 'mastered' &&
        !listed.has(state.itemId) &&
        item?.status === 'active' &&
        item.itemType !== LESSON_TYPE
      )
    })
    .map((state) => state.itemId)
    .toSorted(compareIds)
  const openDeepDives = Object.values(catalog.items)
    .filter(
      (item) =>
        item.about !== null &&
        item.status === 'active' &&
        trackIds.has(item.trackId) &&
        own(items, item.id) === undefined,
    )
    .map((item) => item.id)
    .toSorted(compareIds)
  return {
    tracks,
    due,
    allowedReview: [...due.map((entry) => entry.itemId), ...introduced],
    openDeepDives,
  }
}

// ---------------------------------------------------------------------------------------------
// The allowance (6.5a's type)
// ---------------------------------------------------------------------------------------------

/** The learner's active custom items — what `allowanceOf` is usually given. */
export function activeCustomItemIds(u: UserDay): string[] {
  return u.day.userItems.filter((row) => row.status === 'active').map((row) => row.itemId)
}

/**
 * What the server lets the bot plan for this learner today (`AiPlanAllowance`, 6.5a). Tracks =
 * those in the baseline build's snapshots (started, active — decision 9); `allowedNew` = each
 * track's new-queue head cut to its `effectiveNewPerDay` new SRS items, empty for a track whose
 * snapshot has `extraWeek` (decision 37) — the head is 10 items, so a baseline that places more
 * than 10 new items (cheap cards on a large budget) cannot be reproduced exactly: safe, an AI plan
 * is never faster than the baseline; `allowedReview` = due + introduced, not mastered;
 * `ownCustomItems` = those of `customItems` that are the learner's active custom items;
 * `openDeepDives` = active deep-dives not completed.
 */
export function allowanceOf(u: UserDay, customItems: readonly string[]): AiPlanAllowance {
  const facts = dayFacts(u)
  const active = new Set(activeCustomItemIds(u))
  return {
    today: u.day.today,
    catalog: u.context.catalog,
    activeTrackIds: new Set(facts.tracks.map((track) => track.trackId)),
    budgets: Object.fromEntries(
      facts.tracks.map((track) => [track.trackId, track.enrollment.budgetMinutes]),
    ),
    allowedNew: new Set(facts.tracks.flatMap((track) => track.allowedNew)),
    allowedReview: new Set(facts.allowedReview),
    ownCustomItems: new Set(customItems.filter((itemId) => active.has(itemId))),
    openDeepDives: new Set(facts.openDeepDives),
  }
}

// ---------------------------------------------------------------------------------------------
// The context (§6.4.2)
// ---------------------------------------------------------------------------------------------

type Context = BotContext
type ContextTrack = Context['tracks'][number]

/** `due_above_<n>`: the throttle rule that lowered the cap (§5.5), null when none did. */
function throttleReason(enrollment: Enrollment, snapshot: TrackSnapshot): string | null {
  if (!snapshot.throttled) return null
  const rule = enrollment.throttle
    .filter((candidate) => snapshot.dueCount > candidate.dueAbove)
    .toSorted((a, b) => b.dueAbove - a.dueAbove)[0]
  return rule === undefined ? null : `due_above_${rule.dueAbove}`
}

/** A template block as the contract has it: `fromWeek` is already applied. */
function templateBlockOf(block: PlanTemplateBlock): ContextTrack['templateToday'][number] {
  const { fromWeek, ...rest } = block
  void fromWeek
  return { ...rest }
}

function contextTrack(u: UserDay, facts: TrackFacts): ContextTrack {
  const { enrollment, snapshot, track, roadmap } = facts
  const { catalog, items } = u.context
  const weekday = weekdayOf(u.day.today)
  // §5.12: the day's insert blocks are reserved first, so they head the template (as buildPlan).
  const inserted = insertBlocksOn(facts.overrides, weekday).map((o) => ({
    kind: 'practice' as const,
    minutes: o.params.minutes,
    tag: TOPIC_PRACTICE_TAG,
    topicId: o.params.topicId,
  }))
  return {
    trackId: facts.trackId,
    roadmapVariant: enrollment.variant,
    roadmapWeek: snapshot.week,
    budgetMinutes: enrollment.budgetMinutes,
    templateToday: [
      ...inserted,
      ...dayTemplate(enrollment.weeklyTemplate, weekday, snapshot.week).map(templateBlockOf),
    ],
    effectiveNewPerDay: snapshot.newPerDay,
    throttleReason: throttleReason(enrollment, snapshot),
    upcomingTopics:
      roadmap === null || !reorderable(roadmap)
        ? []
        : upcomingTopics(track, roadmap, facts.overrides, catalog, items),
  }
}

type LearnerReads = {
  shareNotes: boolean
  days: Context['recent']['days']
  results: Context['recent']['results']
  createdToday: number
  notes: NonNullable<Context['untrusted']>['notes'] | null
}

const RESULT_VALUES = ['solved', 'hint', 'failed', 'know', 'unsure', 'dont_know'] as const
const RESULT_MODES = ['recall', 'redo'] as const

type ResultRow = { item_id: string | null; payload: unknown; local_day: string }

/** An `item.result` row as §6.4.2 has it — item, result, mode, local day; never anything else. */
function resultOf(row: ResultRow): Context['recent']['results'][number] | null {
  const payload =
    row.payload !== null && typeof row.payload === 'object' && !Array.isArray(row.payload)
      ? (row.payload as Record<string, unknown>)
      : {}
  const result = RESULT_VALUES.find((value) => value === payload.result)
  const mode = RESULT_MODES.find((value) => value === payload.mode) ?? null
  if (row.item_id === null || result === undefined) return null
  return { itemId: row.item_id, result, mode, localDay: row.local_day }
}

/** `<planDate>:<trackId>:<kind>:<n>` → the kind (§5.4 step 8); null for any other form. */
function blockKindOf(blockId: string): BlockKind | null {
  const kind = blockId.split(':')[2]
  return BLOCK_KINDS.find((candidate) => candidate === kind) ?? null
}

function failed(what: string, cause: unknown): Error {
  return new Error(`Could not read ${what}`, { cause })
}

/** Rows read for a note: enough that a few notes sanitised to nothing still leave five. */
const NOTE_ROWS = CONTEXT_LIMITS.notes * 4

/** Decision 32: at most 5 check-in notes of the last 14 local days, newest first, sanitised. */
async function readNotes(
  admin: Admin,
  userId: string,
  from: LocalDay,
): Promise<NonNullable<Context['untrusted']>['notes']> {
  const { data, error } = await admin
    .from('plan_block_state')
    .select('block_id, note, checked_in_on, checked_in_at')
    .eq('user_id', userId)
    .not('note', 'is', null)
    .gte('checked_in_on', from)
    .order('checked_in_on', { ascending: false })
    .order('checked_in_at', { ascending: false })
    .limit(NOTE_ROWS)
  if (error) throw failed('the check-in notes', error)
  return data
    .flatMap((row) => {
      const text = row.note === null ? null : sanitizeNote(row.note)
      const blockKind = blockKindOf(row.block_id)
      return text === null || blockKind === null
        ? []
        : [{ localDay: row.checked_in_on, blockKind, text }]
    })
    .slice(0, CONTEXT_LIMITS.notes)
}

/** The learner's rows the context reads beyond the day: the notes consent, 14 days of activity,
 *  the latest results and today's new custom items. */
async function readLearner(admin: Admin, userId: string, today: LocalDay): Promise<LearnerReads> {
  const from = addDays(today, -(CONTEXT_LIMITS.recentDays - 1))
  const [profile, activity, results, created] = await Promise.all([
    admin.from('profiles').select('share_notes_with_ai').eq('id', userId).single(),
    readDailyActivity(admin, userId, from),
    admin
      .from('events')
      .select('item_id, payload, local_day')
      .eq('user_id', userId)
      .eq('type', 'item.result')
      .order('occurred_at', { ascending: false })
      .limit(CONTEXT_LIMITS.recentResults),
    admin
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('type', 'user_item.created')
      .eq('local_day', today),
  ])
  if (profile.error) throw failed("the learner's profile", profile.error)
  if (results.error) throw failed('the recent results', results.error)
  if (created.error) throw failed("today's custom items", created.error)
  const shareNotes = profile.data.share_notes_with_ai
  // Newest first, today included; a day without a row is a day without study.
  const days = Array.from({ length: CONTEXT_LIMITS.recentDays }, (_, index) => {
    const localDay = addDays(today, -index)
    const row = own(activity, localDay)
    return {
      localDay,
      completed: row?.completed ?? false,
      minutesByTrack: { ...(row?.minutesByTrack ?? {}) },
    }
  })
  return {
    shareNotes,
    days,
    results: results.data.flatMap((row) => resultOf(row) ?? []),
    createdToday: created.count ?? 0,
    notes: shareNotes ? await readNotes(admin, userId, from) : null,
  }
}

/** The existing plan of today (§6.4.2): its source and how many of its blocks are checked in. */
function existingPlanOf(u: UserDay): Context['existingPlan'] {
  if (u.resolution.kind !== 'today') return null
  const source = u.resolution.read.row.source === 'ai' ? 'ai' : 'baseline'
  return { source, checkedInBlocks: Object.keys(u.blocks).length }
}

/** `GET /runs/{runId}/users/{userRef}/context` (§6.4.2) for the resolved run user. */
export async function buildContext(runUser: RunUser, now: Date): Promise<BotContext> {
  const u = await loadUserDay(runUser.userId, now)
  const admin = createAdminClient()
  const [learner, { settings }] = await Promise.all([
    readLearner(admin, runUser.userId, u.day.today),
    readBotSettings(),
  ])
  const facts = dayFacts(u)
  const { catalog, items } = u.context
  const activeCustom = u.day.userItems.filter((row) => row.status === 'active').length
  const inForce = [...new Set((u.context.overrides ?? []).map((o) => o.trackId))]
    .toSorted(compareIds)
    .flatMap((trackId) => activeOverrides(u.context.overrides ?? [], trackId, u.day.today))

  const context: BotContext = {
    targetDate: u.day.today,
    gate: u.gate,
    existingPlan: existingPlanOf(u),
    tracks: facts.tracks.map((track) => contextTrack(u, track)),
    baselinePlan: { blocks: u.baseline.blocks.map((block) => structuredClone(block)) },
    due: facts.due.slice(0, CONTEXT_LIMITS.due).map((entry) => ({
      itemId: entry.itemId,
      type: entry.item.itemType,
      topic: entry.item.topicId,
      difficulty: entry.item.difficulty,
      level: entry.state.level,
      weak: entry.state.weak,
      daysOverdue: entry.overdueDays,
    })),
    newQueueHead: facts.tracks.flatMap((track) =>
      track.head.flatMap((itemId) => {
        const item = own(catalog.items, itemId)
        return item === undefined
          ? []
          : [
              {
                itemId,
                type: item.itemType,
                topic: item.topicId,
                difficulty: item.difficulty,
                estMinutes: item.minutes.new,
              },
            ]
      }),
    ),
    deepDives: facts.openDeepDives.flatMap((itemId) => {
      const about = own(catalog.items, itemId)?.about ?? null
      return about === null ? [] : [{ itemId, about }]
    }),
    weakTopics: [
      ...new Set(
        weakTopics(items, catalog, new Set(facts.tracks.map((track) => track.trackId))).map(
          (topic) => topic.topicId,
        ),
      ),
    ],
    customItems: u.day.userItems.map((row) => ({
      itemId: row.itemId,
      type: row.itemType,
      topic: row.topicId,
      status: row.status,
      srsStatus: own(items, row.itemId)?.status ?? null,
      createdOn: row.createdOn,
    })),
    // Task 6.6c: the overrides in force with their computed expiry (decision 18).
    overrides: inForce.map((o) => ({
      trackId: o.trackId,
      key: o.key,
      kind: o.kind,
      ...(o.kind === 'insert_block' && { until: o.params.until }),
      ...(o.kind === 'extra_week' && {
        studyDaysLeft: Math.max(0, o.params.studyDays - o.usedDays),
      }),
    })),
    recent: { days: learner.days, results: learner.results },
    constraints: {
      allowedNewItems: facts.tracks.flatMap((track) => track.allowedNew),
      allowedReviewItems: [...facts.allowedReview],
      maxPlannedMinutesRule: MAX_PLANNED_MINUTES_RULE,
      customItems: {
        remainingToday: Math.max(0, settings.limits.customItemsPerDay - learner.createdToday),
        remainingTotal: Math.max(0, settings.limits.customItemsActive - activeCustom),
      },
      // Task 6.6c: the limit less each track's overrides in force.
      overrides: {
        remainingActive: Object.fromEntries(
          facts.tracks.map((track) => [
            track.trackId,
            Math.max(
              0,
              settings.limits.overridesPerTrack -
                inForce.filter((o) => o.trackId === track.trackId).length,
            ),
          ]),
        ),
      },
      rationaleMaxChars: CONTEXT_LIMITS.rationaleMaxChars,
    },
    ...(learner.notes === null ? {} : { untrusted: { notes: learner.notes } }),
  }
  // The allow-list, enforced: an unknown key anywhere throws (a bug — the route's 500).
  return contextResponse.parse(context)
}
