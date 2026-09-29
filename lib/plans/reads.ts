/**
 * The learner's rows the plan service reads (platform design §4.1, §5.2, §5.4; Part B-M5
 * decision 7): bounded reads only — today's plan, the last seen plan (one row), the plans with a
 * recap block and the recap check-ins, every `item_state` row in pages of `max_rows`, the
 * enrollments, the schedule versions and a window of `daily_activity`, never every plan.
 *
 * Server-only and unguarded: the caller is guarded and passes the session client, so RLS limits
 * every read to the signed-in learner's own rows; `userId` filters them explicitly too.
 */
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { HARD_LIMITS } from '@/lib/domain/bot-limits'
import { toEnrollment } from '@/lib/content/plan-catalog'
import type { UserItemRow } from '@/lib/content/user-items'
import type { PlanCatalog } from '@/lib/domain/catalog'
import {
  overrideActive,
  overrideParamsSchemas,
  type RoadmapOverride,
} from '@/lib/domain/plan/overrides'
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
  type BlockStateRow,
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
 * The user's check-ins of recap blocks (block ids `<planDate>:<trackId>:recap:<n>`, §5.4 step 8),
 * keyed by blockKey(planId, blockId). Paged like `readItemStates` (PostgREST `max_rows`): a year
 * of history is never cut off at 1000 rows (RF-4), and no growing list of plan ids is sent.
 */
async function readRecapBlockStates(
  supabase: Client,
  userId: string,
): Promise<Record<string, BlockState>> {
  const rows: BlockStateRow[] = []
  for (let from = 0; ; from += PAGE_ROWS) {
    const { data, error } = await supabase
      .from('plan_block_state')
      .select('*')
      .eq('user_id', userId)
      .like('block_id', '%:recap:%')
      .order('plan_id')
      .order('block_id')
      .range(from, from + PAGE_ROWS - 1)
    if (error) throw failed('the recap check-ins', error)
    rows.push(...data)
    if (data.length < PAGE_ROWS) break
  }
  return Object.fromEntries(
    rows.map((row) => [blockKey(row.plan_id, row.block_id), blockStateFromRow(row)]),
  )
}

/** `blocks @> '[{"kind":"recap"}]'` (jsonb containment), as the JSON PostgREST expects. */
const RECAP_BLOCK = JSON.stringify([{ kind: 'recap' }])

/**
 * Plans with a recap block (jsonb containment, about one a week) and the user's recap check-ins —
 * the input of `recapWeeksDone` (§5.6). A plan that cannot be read is left out; without a recap
 * plan no check-in is read.
 */
export async function readRecapHistory(
  supabase: Client,
  userId: string,
): Promise<{ plans: StoredPlan[]; blocks: Record<string, BlockState> }> {
  const { data, error } = await supabase
    .from('day_plans')
    .select('*')
    .eq('user_id', userId)
    // As JSON text: postgrest-js would send an array as a Postgres array literal (22P02).
    .contains('blocks', RECAP_BLOCK)
    .order('plan_date')
  if (error) throw failed('the recap history', error)
  const plans = data.flatMap((row) => {
    const plan = storedPlanFromRow(row)
    return plan === null ? [] : [plan]
  })
  return { plans, blocks: plans.length === 0 ? {} : await readRecapBlockStates(supabase, userId) }
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

const USER_ITEM_COLUMNS = 'item_id, item_type, track_id, topic_id, payload, status, created_on'
const USER_ITEM_TYPES = ['flashcard', 'exercise', 'prompt'] as const
const USER_ITEM_STATUSES = ['active', 'hidden', 'retired'] as const

type UserItemDbRow = Pick<
  Database['public']['Tables']['user_items']['Row'],
  'item_id' | 'item_type' | 'track_id' | 'topic_id' | 'payload' | 'status' | 'created_on'
>

function userItemFromRow(row: UserItemDbRow): UserItemRow | null {
  const itemType = USER_ITEM_TYPES.find((type) => type === row.item_type)
  const status = USER_ITEM_STATUSES.find((candidate) => candidate === row.status)
  if (itemType === undefined || status === undefined) return null
  return {
    itemId: row.item_id,
    itemType,
    trackId: row.track_id,
    topicId: row.topic_id,
    payload: row.payload,
    status,
    createdOn: row.created_on,
  }
}

/**
 * The user's custom items (§4.1 `user_items`, §5.12; task 6.6a): the active ones — at most
 * `HARD_LIMITS.customItemsActive`, the quota the database enforces (decision 33), one read — then
 * every hidden and retired one, paged by `PAGE_ROWS` (PostgREST `max_rows`) like
 * `readItemStates`, so none is ever cut off (a retire target, an item page). Each by ID. Hidden
 * and retired rows are read too: their items stay readable and the "Mục riêng" tab lists the
 * hidden ones (`withUserItems` reads them as retired). The session client (RLS: own rows) for a
 * learner, the secret key for the bot (every read filters `user_id`).
 */
export async function readUserItems(supabase: Client, userId: string): Promise<UserItemRow[]> {
  const active = await supabase
    .from('user_items')
    .select(USER_ITEM_COLUMNS)
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('item_id')
    .limit(HARD_LIMITS.customItemsActive)
  if (active.error) throw failed('the custom items', active.error)
  const rows: UserItemDbRow[] = [...active.data]
  for (let from = 0; ; from += PAGE_ROWS) {
    const { data, error } = await supabase
      .from('user_items')
      .select(USER_ITEM_COLUMNS)
      .eq('user_id', userId)
      .in('status', ['hidden', 'retired'])
      .order('status')
      .order('item_id')
      .range(from, from + PAGE_ROWS - 1)
    if (error) throw failed('the custom items', error)
    rows.push(...data)
    if (data.length < PAGE_ROWS) break
  }
  return rows.flatMap((row) => {
    const item = userItemFromRow(row)
    return item === null ? [] : [item]
  })
}

// ---------------------------------------------------------------------------------------------
// Roadmap overrides (§5.12; Part B-M6 decision 18; task 6.6c)
// ---------------------------------------------------------------------------------------------

const OVERRIDE_KINDS = ['insert_block', 'extra_week', 'reorder_topics'] as const
const OVERRIDE_STATUSES = ['active', 'revoked', 'suspended'] as const
const OVERRIDE_COLUMNS =
  'track_id, key, kind, params, status, revoked_by, until_local_day, study_days, start_local_day'
/** Plans an extra week's count reads: it names at most `study_days` (≤ 5) plans while it runs. */
const EXTRA_WEEK_PLAN_ROWS = 32

/** One `roadmap_overrides` row as the plan service, the bot and `/settings` read it. */
export type OverrideRow = {
  readonly trackId: string
  readonly key: string
  readonly kind: RoadmapOverride['kind']
  readonly status: (typeof OVERRIDE_STATUSES)[number]
  readonly revokedBy: 'learner' | 'bot' | null
  readonly startLocalDay: LocalDay
  /** The stored params as they are (the bot's `unchanged` check compares them). */
  readonly params: unknown
  /**
   * The override as the engine reads it, its params parsed (`overrideParamsSchemas`); null when
   * they no longer parse. An `extra_week`'s `usedDays` counts the stored plans dated on or after
   * its start **and before `today`** whose track snapshot names it: today's own plan is left out,
   * so building or rebuilding today's plan sees the extra week it is part of (decision 18's count
   * less today's row — carried item (b)).
   */
  readonly override: RoadmapOverride | null
  /** An `extra_week`'s plans before `today` (as `override.usedDays`); 0 for other kinds. */
  readonly usedDays: number
  /** SQL's count (`roadmap_override_active`): today's plan included. 0 for other kinds. */
  readonly sqlUsedDays: number
}

/** Plan dates on or after `from` whose `trackId` snapshot names extra week `key` (jsonb
 *  containment, so any track id works). */
async function extraWeekPlanDates(
  supabase: Client,
  userId: string,
  trackId: string,
  key: string,
  from: LocalDay,
): Promise<LocalDay[]> {
  const { data, error } = await supabase
    .from('day_plans')
    .select('plan_date')
    .eq('user_id', userId)
    .gte('plan_date', from)
    .contains('roadmap_weeks', JSON.stringify({ [trackId]: { extraWeek: key } }))
    .order('plan_date')
    .limit(EXTRA_WEEK_PLAN_ROWS)
  if (error) throw failed("the extra week's plans", error)
  return data.map((row) => row.plan_date)
}

type OverrideDbRow = Pick<
  Database['public']['Tables']['roadmap_overrides']['Row'],
  | 'track_id'
  | 'key'
  | 'kind'
  | 'params'
  | 'status'
  | 'revoked_by'
  | 'until_local_day'
  | 'study_days'
  | 'start_local_day'
>

function engineOverride(row: OverrideDbRow, usedDays: number): RoadmapOverride | null {
  const base = { trackId: row.track_id, key: row.key, startLocalDay: row.start_local_day }
  switch (row.kind) {
    case 'insert_block': {
      const parsed = overrideParamsSchemas.insert_block.safeParse(row.params)
      return parsed.success ? { ...base, kind: 'insert_block', params: parsed.data } : null
    }
    case 'extra_week': {
      const parsed = overrideParamsSchemas.extra_week.safeParse(row.params)
      return parsed.success ? { ...base, kind: 'extra_week', params: parsed.data, usedDays } : null
    }
    case 'reorder_topics': {
      const parsed = overrideParamsSchemas.reorder_topics.safeParse(row.params)
      return parsed.success ? { ...base, kind: 'reorder_topics', params: parsed.data } : null
    }
    default:
      return null
  }
}

/**
 * The user's `roadmap_overrides` rows of `statuses` (every status by default), by track and key,
 * each with its engine form and an `extra_week`'s counts (one bounded read per extra week that is
 * not revoked). The session client (RLS: own rows) for a learner, the secret key for the bot.
 */
export async function readOverrideRows(
  supabase: Client,
  userId: string,
  today: LocalDay,
  statuses: readonly OverrideRow['status'][] = OVERRIDE_STATUSES,
): Promise<OverrideRow[]> {
  const { data, error } = await supabase
    .from('roadmap_overrides')
    .select(OVERRIDE_COLUMNS)
    .eq('user_id', userId)
    .in('status', [...statuses])
    .order('track_id')
    .order('key')
  if (error) throw failed('the roadmap overrides', error)
  const rows = await Promise.all(
    data.map(async (row): Promise<OverrideRow | null> => {
      const kind = OVERRIDE_KINDS.find((candidate) => candidate === row.kind)
      const status = OVERRIDE_STATUSES.find((candidate) => candidate === row.status)
      if (kind === undefined || status === undefined) return null
      const dates =
        kind === 'extra_week' && status !== 'revoked'
          ? await extraWeekPlanDates(supabase, userId, row.track_id, row.key, row.start_local_day)
          : []
      // LocalDay is a zero-padded `YYYY-MM-DD` string: string order is chronological order.
      const usedDays = dates.filter((date) => date < today).length
      return {
        trackId: row.track_id,
        key: row.key,
        kind,
        status,
        revokedBy: row.revoked_by === 'learner' || row.revoked_by === 'bot' ? row.revoked_by : null,
        startLocalDay: row.start_local_day,
        params: row.params,
        override: engineOverride(row, usedDays),
        usedDays,
        sqlUsedDays: dates.length,
      }
    }),
  )
  return rows.flatMap((row) => (row === null ? [] : [row]))
}

/**
 * The overrides the plan engine applies on `today` (§5.12, decision 18): only while the user's AI
 * flag is on (`profiles.ai_personalization`; none without a profile row), status `active` (not
 * revoked, not suspended), params that parse, and active by the computed expiry
 * (`overrideActive`). `PlanContext.overrides` (`planContext`) — so `ensureToday`, rebuilds,
 * "Học thêm", the bot context and the AI plan write all see the effective roadmap.
 */
export async function readOverrides(
  supabase: Client,
  userId: string,
  today: LocalDay,
): Promise<RoadmapOverride[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('ai_personalization')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw failed("the learner's AI flag", error)
  if (data?.ai_personalization !== true) return []
  const rows = await readOverrideRows(supabase, userId, today, ['active'])
  return rows.flatMap((row) =>
    row.override !== null && overrideActive(row.override, today) ? [row.override] : [],
  )
}
