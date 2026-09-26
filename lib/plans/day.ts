/**
 * The steps `ensureToday`, `resumeToday`, `rebuildTodayIfUntouched` and `currentPlan` share
 * (platform design §5.2, §5.4): load the learner's day (step 1), resolve it without writing
 * (steps 2–4), and the context and checks of a plan build (step 5; Part B-M5 decision 10).
 * Server-only; the entry points check the session user first (decision 5).
 */
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import type { PlanCatalog } from '@/lib/domain/catalog'
import { gateStatus, unfinishedBlocks } from '@/lib/domain/plan/gate'
import { recapWeeksDone } from '@/lib/domain/plan/history'
import {
  planBlockSchema,
  trackSnapshotSchema,
  type DayPlan,
  type Enrollment,
  type PlanContext,
} from '@/lib/domain/plan/types'
import type { ItemState } from '@/lib/domain/state'
import type { LocalDay, ScheduleVersion } from '@/lib/domain/time/localDay'
import type { Database } from '@/lib/supabase/database.types'
import { planCatalog } from './catalog'
import {
  readBlockStates,
  readEnrollments,
  readItemStates,
  readLastSeenPlan,
  readPlan,
  readRecapHistory,
  readScheduleVersions,
  todayOf,
  type PlanRead,
} from './reads'
import type { TodayState } from './today'

type Client = SupabaseClient<Database>

/** What §5.4 step 1 reads: the learner's schedule, enrollments and item states, at `clock`. */
export type Day = {
  readonly clock: Date
  readonly today: LocalDay
  readonly catalog: PlanCatalog
  readonly versions: readonly ScheduleVersion[]
  /** Every enrollment, removed ones too (`readEnrollments`). */
  readonly enrollments: readonly Enrollment[]
  readonly items: Readonly<Record<string, ItemState>>
  /** The tracks of the `active` enrollments: only their blocks hold the gate (M-5 A). */
  readonly activeTrackIds: ReadonlySet<string>
}

/** §5.4 step 1: the learner's day at `clock`. */
export async function loadDay(supabase: Client, userId: string, clock: Date): Promise<Day> {
  const catalog = planCatalog()
  const [versions, enrollments, items] = await Promise.all([
    readScheduleVersions(supabase, userId),
    readEnrollments(supabase, userId, catalog),
    readItemStates(supabase, userId),
  ])
  const active = enrollments.filter((enrollment) => enrollment.status === 'active')
  return {
    clock,
    today: todayOf(versions, clock),
    catalog,
    versions,
    enrollments,
    items,
    activeTrackIds: new Set(active.map((enrollment) => enrollment.trackId)),
  }
}

type State<K extends TodayState['kind']> = Extract<TodayState, { readonly kind: K }>

/** §5.4 step 2 (§5.9): no active track, or every active track starts after today. */
function trackState(day: Day): State<'noTracks'> | State<'notStarted'> | null {
  const starts = day.enrollments
    .filter((enrollment) => enrollment.status === 'active')
    .map((enrollment) => enrollment.startDate)
    // LocalDay is a zero-padded `YYYY-MM-DD` string: string order is chronological order.
    .toSorted()
  const [earliest] = starts
  if (earliest === undefined) return { kind: 'noTracks' }
  return earliest > day.today ? { kind: 'notStarted', startDate: earliest } : null
}

/**
 * The gate on the last seen plan before `today` (§5.2, M-5 A): the paused state while it is
 * closed, the resumed state when it opened today (decision 32 of M4), else null — open, and
 * today's plan may be built. An unreadable last seen plan counts as a plan without blocks: open,
 * and never shown (M-4, RF-4).
 */
export async function gateState(
  supabase: Client,
  userId: string,
  today: LocalDay,
  activeTrackIds: ReadonlySet<string>,
): Promise<State<'paused'> | State<'resumed'> | null> {
  const plan = (await readLastSeenPlan(supabase, userId, today))?.plan ?? null
  if (plan === null) return null
  const blocks = await readBlockStates(supabase, [plan.id])
  const gate = gateStatus([plan], blocks, today, activeTrackIds)
  if (!gate.open) {
    return {
      kind: 'paused',
      plan,
      unfinished: unfinishedBlocks(plan, blocks, activeTrackIds),
      blocks,
      daysSince: gate.daysSince,
      offerResume: gate.offerResume,
    }
  }
  return gate.resumedToday ? { kind: 'resumed', plan, blocks } : null
}

/** A day resolved without writing (§5.4 steps 2–4): today's stored row, a state without a plan
 *  of today, or `open` — today's plan is to be built. */
export type Resolution =
  | { readonly kind: 'today'; readonly read: PlanRead }
  | State<'noTracks'>
  | State<'notStarted'>
  | State<'paused'>
  | State<'resumed'>
  | { readonly kind: 'open' }

export async function resolveDay(supabase: Client, userId: string, day: Day): Promise<Resolution> {
  const read = await readPlan(supabase, userId, day.today)
  if (read !== null) return { kind: 'today', read }
  const tracks = trackState(day)
  if (tracks !== null) return tracks
  return (await gateState(supabase, userId, day.today, day.activeTrackIds)) ?? { kind: 'open' }
}

/** What `buildPlan` / `buildResumePlan` read for `day` (§5.4): the recap weeks done included. */
export async function planContext(
  supabase: Client,
  userId: string,
  day: Day,
): Promise<PlanContext> {
  const history = await readRecapHistory(supabase, userId)
  return {
    planDate: day.today,
    catalog: day.catalog,
    enrollments: day.enrollments,
    items: day.items,
    recapDone: recapWeeksDone(history.plans, history.blocks, day.enrollments),
  }
}

const blocksSchema = z.array(planBlockSchema)
const tracksSchema = z.record(z.string(), trackSnapshotSchema)

/**
 * Decision 10 (M-4): the server never stores a plan it cannot read back — every block passes
 * `planBlockSchema` and every snapshot `trackSnapshotSchema` (what `storedPlanFromRow` reads).
 * An engine result that does not is a bug: it throws (the route's error boundary).
 */
export function storable(plan: DayPlan): DayPlan {
  const blocks = blocksSchema.safeParse(plan.blocks)
  const tracks = tracksSchema.safeParse(plan.tracks)
  if (!blocks.success || !tracks.success) {
    throw new Error(`The plan engine built a plan for ${plan.planDate} that cannot be stored`, {
      cause: blocks.error ?? tracks.error,
    })
  }
  return plan
}
