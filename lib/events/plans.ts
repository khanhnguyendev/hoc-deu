/**
 * The day's plan in the database (platform design §2.3, §4.1, §4.4, §5.4; Part B-M4 decisions 12,
 * 33): `storePlan` writes it through `apply_system_event` (`plan.generated`, secret key), which
 * takes the `(user, plan_date)` lock, refuses a second plan for a date and a rebuild of a plan in
 * use; `storedPlanFromRow` reads a `day_plans` row back for the engine.
 */
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import {
  planBlockSchema,
  trackSnapshotSchema,
  type DayPlan,
  type StoredPlan,
} from '@/lib/domain/plan/types'
import type { Database, Json } from '@/lib/supabase/database.types'
import { EventError, eventErrorOf, systemEventBody } from './apply'

export type DayPlanRow = Database['public']['Tables']['day_plans']['Row']

export type PlanWriteMode = 'baseline' | 'resume' | 'rebuild'
/**
 * `applied`: stored (a new plan, or the rebuilt one). `duplicate`: an event with this id was
 * already recorded. `plan_exists`: the date already has a plan (baseline / resume). `plan_in_use`:
 * the plan has a check-in or an event naming it, so it is not rebuilt (§2.3). Nothing changes
 * except for `applied`.
 */
export type PlanWriteOutcome = 'applied' | 'duplicate' | 'plan_exists' | 'plan_in_use'

/** Baseline and resume create version 1 of a new plan; a rebuild replaces version n with n + 1. */
function versionsAgree(mode: PlanWriteMode, expectedVersion: number): boolean {
  return (
    Number.isInteger(expectedVersion) &&
    (mode === 'rebuild' ? expectedVersion >= 1 : expectedVersion === 0)
  )
}

function planWriteResult(data: Json | null): {
  readonly outcome: PlanWriteOutcome
  readonly planId: string | null
} {
  const result: { [key: string]: Json | undefined } =
    data !== null && typeof data === 'object' && !Array.isArray(data) ? data : {}
  const { outcome, plan_id: planId } = result
  if (outcome === 'duplicate') return { outcome, planId: null }
  if (
    (outcome === 'applied' || outcome === 'plan_exists' || outcome === 'plan_in_use') &&
    typeof planId === 'string'
  ) {
    return { outcome, planId }
  }
  throw new EventError('unknown')
}

/**
 * plan.generated through apply_system_event (secret-key client, after requireActive). Every plan
 * is built for today, so the event carries `local_day` = its plan date (decision 10): a request
 * that crosses the day start (the plan built for D, stored after D's end) raises `day_changed`
 * instead of storing D's plan on D + 1 — the caller rebuilds for the new day.
 */
export async function storePlan(
  admin: SupabaseClient<Database>,
  userId: string,
  input: {
    readonly eventId: string
    readonly plan: DayPlan
    readonly mode: PlanWriteMode
    /** 0 for baseline / resume; the current version for rebuild. */
    readonly expectedVersion: number
  },
): Promise<{ readonly outcome: PlanWriteOutcome; readonly planId: string | null }> {
  const { eventId, plan, mode, expectedVersion } = input
  if (!versionsAgree(mode, expectedVersion)) {
    throw new EventError('invalid_event')
  }
  const p_event = systemEventBody({
    id: eventId,
    type: 'plan.generated',
    payload: { mode, planVersion: expectedVersion + 1 },
    localDay: plan.planDate,
  })
  // The engine's blocks and snapshots are plain JSON (lib/domain/plan/types.ts), camelCase inside.
  const row: { [column: string]: Json } = {
    plan_date: plan.planDate,
    blocks: [...plan.blocks],
    roadmap_weeks: { ...plan.tracks },
  }
  const { data, error } = await admin.rpc('apply_system_event', {
    p_user_id: userId,
    p_event,
    p_changes: [{ table: 'day_plans', row }],
    p_expected: { [`day_plans:${plan.planDate}`]: expectedVersion },
  })
  if (error) {
    throw eventErrorOf(error)
  }
  return planWriteResult(data)
}

const blocksSchema = z.array(planBlockSchema)
const tracksSchema = z.record(z.string(), trackSnapshotSchema)

/**
 * A day_plans row → StoredPlan; blocks and roadmap_weeks Zod-validated (planBlockSchema,
 * trackSnapshotSchema); a malformed row → null (M5 treats it as no plan and rebuilds).
 */
export function storedPlanFromRow(row: DayPlanRow): StoredPlan | null {
  const blocks = blocksSchema.safeParse(row.blocks)
  const tracks = tracksSchema.safeParse(row.roadmap_weeks)
  if (!blocks.success || !tracks.success) return null
  if (row.source !== 'baseline' && row.source !== 'ai') return null
  return {
    id: row.id,
    planDate: row.plan_date,
    version: row.version,
    source: row.source,
    seenAt: row.seen_at,
    blocks: blocks.data,
    tracks: tracks.data,
  }
}
