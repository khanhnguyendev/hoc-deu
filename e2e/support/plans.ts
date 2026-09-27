/**
 * Plans, check-ins and item states for the `/today` specs (task 5.1b), written with the local
 * stack's secret key like `users.ts` (the insert triggers only check the `authenticated` role).
 * Cleanup deletes users (`deleteTestUser`, whose cascade removes their plans) — never a plan
 * (decision 35 of M4; `tools/guards/e2e-cleanup.test.ts`). Only types are imported from `lib/`.
 */
import { createRequire } from 'node:module'
import type * as Supabase from '@supabase/supabase-js'
import type { Database, Json } from '@/lib/supabase/database.types'

const { createClient } = createRequire(import.meta.url)('@supabase/supabase-js') as typeof Supabase

let client: Supabase.SupabaseClient<Database> | undefined

/** The secret-key client for the local stack (bypasses RLS). */
function admin(): Supabase.SupabaseClient<Database> {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const secretKey = process.env.SUPABASE_SECRET_KEY
    if (!url || !secretKey) {
      throw new Error('The local Supabase env is missing — run e2e through playwright.config.ts.')
    }
    client = createClient<Database>(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return client
}

const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000

/** `YYYY-MM-DD` plus `days`. */
export function addDays(day: string, days: number): string {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(Date.UTC(year!, month! - 1, date! + days)).toISOString().slice(0, 10)
}

/** `25 tháng 9, 2026` — `formatDay` of `lib/i18n/format.ts` (vi-VN, the day as a UTC date). */
export function formatViDay(day: string): string {
  const [year, month, date] = day.split('-').map(Number)
  return new Intl.DateTimeFormat('vi-VN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(Date.UTC(year!, month! - 1, date!))
}

export type StableSchedule = {
  timezone: string
  dayStartsAt: string
  effectiveAt: string
  /** The learner's local day now, under this schedule. */
  today: string
}

/**
 * A UTC schedule whose day start is at least 6 hours away from `now` in both directions (day
 * starts are 00:00–12:00): the local day the test computes stays the app's for the whole test,
 * whatever time CI runs it. In force for 30 days.
 */
export function stableSchedule(now = Date.now()): StableSchedule {
  const hour = new Date(now).getUTCHours()
  const start = hour >= 12 ? hour - 12 : hour < 6 ? 12 : 0
  return {
    timezone: 'UTC',
    dayStartsAt: `${String(start).padStart(2, '0')}:00`,
    effectiveAt: new Date(now - 30 * DAY_MS).toISOString(),
    today: new Date(now - start * HOUR_MS).toISOString().slice(0, 10),
  }
}

export type SeedBlock = {
  id: string
  trackId: string
  kind: 'review' | 'new' | 'recap' | 'practice' | 'extra'
  estMinutes: number
  items: { itemId: string; mode: 'new' | 'review' | 'recall' | 'redo'; minutes: number }[]
}

/** Block `<date>:<track>:new:1` holding `items` as new items (a valid `planBlockSchema` block). */
export function newBlock(
  date: string,
  trackId: string,
  items: { itemId: string; minutes: number }[],
): SeedBlock {
  return {
    id: `${date}:${trackId}:new:1`,
    trackId,
    kind: 'new',
    estMinutes: items.reduce((sum, item) => sum + item.minutes, 0),
    items: items.map(({ itemId, minutes }) => ({ itemId, mode: 'new', minutes })),
  }
}

/** A plan-time track snapshot (`trackSnapshotSchema`) in week 1, not throttled. */
export function snapshot(variant: string) {
  return { variant, week: 1, dueCount: 0, newPerDay: null, throttled: false, reviewDebt: false }
}

/** Inserts a `day_plans` row (version 1, baseline); `seenAt` null = never seen. Its id. */
export async function seedPlan(
  userId: string,
  plan: {
    planDate: string
    blocks: SeedBlock[]
    tracks: Record<string, ReturnType<typeof snapshot>>
    seenAt?: string | null
  },
): Promise<string> {
  const { data, error } = await admin()
    .from('day_plans')
    .insert({
      user_id: userId,
      plan_date: plan.planDate,
      blocks: plan.blocks as unknown as Json,
      roadmap_weeks: plan.tracks as unknown as Json,
      seen_at: plan.seenAt ?? null,
    })
    .select('id')
    .single()
  if (error) throw new Error(`seedPlan(${userId}, ${plan.planDate}) failed: ${error.message}`)
  return data.id
}

/** A check-in of one block (`plan_block_state`), counted for `checkedInOn`. */
export async function seedBlockState(
  userId: string,
  planId: string,
  state: {
    blockId: string
    trackId: string
    status: 'done' | 'partial' | 'skipped'
    minutes: number
    checkedInOn: string
    auto?: boolean
  },
): Promise<void> {
  const { error } = await admin()
    .from('plan_block_state')
    .insert({
      user_id: userId,
      plan_id: planId,
      block_id: state.blockId,
      track_id: state.trackId,
      status: state.status,
      minutes: state.minutes,
      checked_in_on: state.checkedInOn,
      auto: state.auto ?? false,
    })
  if (error) throw new Error(`seedBlockState(${state.blockId}) failed: ${error.message}`)
}

/** Introduced items (`item_state`): Weak at level 1 unless `status` says otherwise. */
export async function seedItemStates(
  userId: string,
  items: {
    itemId: string
    trackId: string
    topicId: string | null
    itemType: string
    introducedOn: string
    dueOn?: string | null
    status?: 'weak' | 'ok' | 'strong' | 'mastered' | 'skipped'
  }[],
): Promise<void> {
  const { error } = await admin()
    .from('item_state')
    .insert(
      items.map((item) => {
        const status = item.status ?? 'weak'
        return {
          user_id: userId,
          item_id: item.itemId,
          track_id: item.trackId,
          topic_id: item.topicId,
          item_type: item.itemType,
          level: 1,
          weak: status === 'weak',
          status,
          due_on: item.dueOn ?? null,
          last_result: status === 'weak' ? 'failed' : 'solved',
          last_result_on: item.introducedOn,
          introduced_on: item.introducedOn,
          reps: 1,
          lapses: 0,
        }
      }),
    )
  if (error) throw new Error(`seedItemStates(${userId}) failed: ${error.message}`)
}

/** Sets an enrollment's status directly (no event): the plan service reads `user_tracks`. */
export async function setEnrollmentStatus(
  userId: string,
  trackId: string,
  status: 'active' | 'paused' | 'removed',
): Promise<void> {
  const { error } = await admin()
    .from('user_tracks')
    .update({ status })
    .eq('user_id', userId)
    .eq('track_id', trackId)
  if (error) throw new Error(`setEnrollmentStatus(${trackId}, ${status}) failed: ${error.message}`)
}

export type PlanRow = { id: string; plan_date: string; seen_at: string | null; version: number }

/** The user's `day_plans` rows, oldest first. */
export async function plansOf(userId: string): Promise<PlanRow[]> {
  const { data, error } = await admin()
    .from('day_plans')
    .select('id, plan_date, seen_at, version')
    .eq('user_id', userId)
    .order('plan_date')
  if (error) throw new Error(`plansOf(${userId}) failed: ${error.message}`)
  return data
}
