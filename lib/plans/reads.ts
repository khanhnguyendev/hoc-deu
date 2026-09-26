/**
 * The learner's rows the plan service reads (platform design §4.1, §5.2, §5.4; Part B-M5
 * decision 7): bounded reads only — today's plan, the last seen plan (one row), the plans with a
 * recap block and their block states, every `item_state` row in pages of `max_rows`, the
 * enrollments, the schedule versions and a window of `daily_activity`, never every plan.
 *
 * Server-only and unguarded: the caller is guarded and passes the session client, so RLS limits
 * every read to the signed-in learner's own rows; `userId` filters them explicitly too.
 */
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { toEnrollment } from '@/lib/content/plan-catalog'
import type { PlanCatalog } from '@/lib/domain/catalog'
import type { Enrollment, StoredPlan } from '@/lib/domain/plan/types'
import { blockKey, type BlockState, type DailyActivity, type ItemState } from '@/lib/domain/state'
import {
  localDay,
  scheduleAt,
  type LocalDay,
  type ScheduleVersion,
} from '@/lib/domain/time/localDay'
import {
  blockStateFromRow,
  dailyActivityFromRow,
  itemStateFromRow,
  type ItemStateRow,
} from '@/lib/events/derived'
import { storedPlanFromRow, type DayPlanRow } from '@/lib/events/plans'
import type { Database } from '@/lib/supabase/database.types'

type Client = SupabaseClient<Database>

/** PostgREST's `max_rows` (supabase/config.toml): the most rows one request returns. */
export const PAGE_ROWS = 1000
/** The database's bound on `item_state` rows per user (`too_many_items`; M4 decision 11). */
export const ITEM_STATE_CAP = 5000

function failed(what: string, cause: unknown): Error {
  return new Error(`Could not read ${what}`, { cause })
}

/** Every schedule version of the user, oldest first (`effectiveAt` as ISO-8601 UTC). */
export async function readScheduleVersions(
  supabase: Client,
  userId: string,
): Promise<ScheduleVersion[]> {
  const { data, error } = await supabase
    .from('schedule_versions')
    .select('timezone, day_starts_at, effective_at')
    .eq('user_id', userId)
    .order('effective_at')
  if (error) throw failed('the schedule versions', error)
  return data.map((row) => ({
    timezone: row.timezone,
    // `time` reads as HH:MM:SS; day starts are whole minutes (decision 5 of M2).
    dayStartsAt: row.day_starts_at.slice(0, 5),
    effectiveAt: new Date(row.effective_at).toISOString(),
  }))
}

/** The learner's local day now: localDay(now, scheduleAt(versions, now)) (§5.1). */
export function todayOf(versions: readonly ScheduleVersion[], now: Date): LocalDay {
  return localDay(now, scheduleAt(versions, now))
}

/** Every enrollment (removed ones too), through `toEnrollment`; unknown tracks dropped. */
export async function readEnrollments(
  supabase: Client,
  userId: string,
  catalog: PlanCatalog,
): Promise<Enrollment[]> {
  const { data, error } = await supabase
    .from('user_tracks')
    .select(
      'track_id, roadmap_variant, status, start_date, budget_minutes, new_per_day, throttle, weekly_template, include_bonus, reset_on',
    )
    .eq('user_id', userId)
    .order('track_id')
  if (error) throw failed('the enrolled tracks', error)
  return data.flatMap((row) => {
    const enrollment = toEnrollment(
      {
        trackId: row.track_id,
        roadmapVariant: row.roadmap_variant,
        status: row.status,
        startDate: row.start_date,
        budgetMinutes: row.budget_minutes,
        newPerDay: row.new_per_day,
        throttle: row.throttle,
        weeklyTemplate: row.weekly_template,
        includeBonus: row.include_bonus,
        resetOn: row.reset_on,
      },
      catalog,
    )
    return enrollment === null ? [] : [enrollment]
  })
}

/**
 * Every `item_state` row of the user, keyed by item id. Pages with `.order('item_id').range(…)` in
 * chunks of `PAGE_ROWS` (PostgREST `max_rows`), up to the `ITEM_STATE_CAP`-row cap (decision 7).
 * /review (5.3) and the track page (5.4) read item states through it too.
 */
export async function readItemStates(
  supabase: Client,
  userId: string,
): Promise<Record<string, ItemState>> {
  const rows: ItemStateRow[] = []
  for (let from = 0; from < ITEM_STATE_CAP; from += PAGE_ROWS) {
    const { data, error } = await supabase
      .from('item_state')
      .select('*')
      .eq('user_id', userId)
      .order('item_id')
      .range(from, from + PAGE_ROWS - 1)
    if (error) throw failed('the item states', error)
    rows.push(...data)
    if (data.length < PAGE_ROWS) break
  }
  // Object.fromEntries defines own properties, so an ID such as `__proto__` is just a key.
  return Object.fromEntries(rows.map((row) => [row.item_id, itemStateFromRow(row)]))
}

/** A `day_plans` row and the plan it holds; `plan` is null when the row cannot be read (M-4). */
export type PlanRead = { readonly row: DayPlanRow; readonly plan: StoredPlan | null }

function planRead(row: DayPlanRow | null): PlanRead | null {
  return row === null ? null : { row, plan: storedPlanFromRow(row) }
}

/** The user's plan for `planDate`, or null when there is none. */
export async function readPlan(
  supabase: Client,
  userId: string,
  planDate: LocalDay,
): Promise<PlanRead | null> {
  const { data, error } = await supabase
    .from('day_plans')
    .select('*')
    .eq('user_id', userId)
    .eq('plan_date', planDate)
    .maybeSingle()
  if (error) throw failed('the day plan', error)
  return planRead(data)
}

/** The user's plan with this id, or null when there is none. */
export async function readPlanById(
  supabase: Client,
  userId: string,
  planId: string,
): Promise<PlanRead | null> {
  const { data, error } = await supabase
    .from('day_plans')
    .select('*')
    .eq('user_id', userId)
    .eq('id', planId)
    .maybeSingle()
  if (error) throw failed('the day plan', error)
  return planRead(data)
}

/** The seen plan with the latest plan_date before `today` (§5.2) — one row. */
export async function readLastSeenPlan(
  supabase: Client,
  userId: string,
  today: LocalDay,
): Promise<PlanRead | null> {
  const { data, error } = await supabase
    .from('day_plans')
    .select('*')
    .eq('user_id', userId)
    .not('seen_at', 'is', null)
    .lt('plan_date', today)
    .order('plan_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw failed('the last seen plan', error)
  return planRead(data)
}

/** The block states of `planIds`, keyed by blockKey(planId, blockId). */
export async function readBlockStates(
  supabase: Client,
  planIds: readonly string[],
): Promise<Record<string, BlockState>> {
  if (planIds.length === 0) return {}
  const { data, error } = await supabase
    .from('plan_block_state')
    .select('*')
    .in('plan_id', [...planIds])
  if (error) throw failed('the block check-ins', error)
  return Object.fromEntries(
    data.map((row) => [blockKey(row.plan_id, row.block_id), blockStateFromRow(row)]),
  )
}

/**
 * Plans with a recap block (jsonb containment, about one a week) and their block states — the
 * input of `recapWeeksDone` (§5.6). A plan that cannot be read is left out.
 */
export async function readRecapHistory(
  supabase: Client,
  userId: string,
): Promise<{ plans: StoredPlan[]; blocks: Record<string, BlockState> }> {
  const { data, error } = await supabase
    .from('day_plans')
    .select('*')
    .eq('user_id', userId)
    .contains('blocks', [{ kind: 'recap' }])
    .order('plan_date')
  if (error) throw failed('the recap history', error)
  const plans = data.flatMap((row) => {
    const plan = storedPlanFromRow(row)
    return plan === null ? [] : [plan]
  })
  return {
    plans,
    blocks: await readBlockStates(
      supabase,
      plans.map((plan) => plan.id),
    ),
  }
}

/** The user's `daily_activity` rows from `from` on, keyed by local day. */
export async function readDailyActivity(
  supabase: Client,
  userId: string,
  from: LocalDay,
): Promise<Record<LocalDay, DailyActivity>> {
  const { data, error } = await supabase
    .from('daily_activity')
    .select('*')
    .eq('user_id', userId)
    .gte('local_day', from)
    .order('local_day')
  if (error) throw failed('the daily activity', error)
  return Object.fromEntries(data.map((row) => [row.local_day, dailyActivityFromRow(row)]))
}

const PLAN_MODES = ['baseline', 'resume', 'rebuild'] as const
type PlanWriteMode = (typeof PLAN_MODES)[number]

/** The `mode` of the plan's latest `plan.generated` event (decision 11), null when none. */
export async function readPlanMode(
  supabase: Client,
  userId: string,
  planId: string,
): Promise<PlanWriteMode | null> {
  const { data, error } = await supabase
    .from('events')
    .select('payload')
    .eq('user_id', userId)
    .eq('plan_id', planId)
    .eq('type', 'plan.generated')
    .order('occurred_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw failed("the plan's generation", error)
  const payload = data?.payload
  const mode =
    payload !== null && typeof payload === 'object' && !Array.isArray(payload)
      ? payload.mode
      : undefined
  return PLAN_MODES.find((candidate) => candidate === mode) ?? null
}
