import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { buildPlan } from '@/lib/domain/plan/buildPlan'
import type { DayPlan, StoredPlan } from '@/lib/domain/plan/types'
import { EventError, withRetry } from '@/lib/events/apply'
import { storePlan } from '@/lib/events/plans'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Database } from '@/lib/supabase/database.types'
import { createClient } from '@/lib/supabase/server'
import { loadDay, planContext, storable, type Day } from './day'
import { readPlan, readPlanMode } from './reads'
import { assertSessionUser } from './session'

type Client = SupabaseClient<Database>

export type RebuildOutcome = 'rebuilt' | 'no_plan' | 'in_use' | 'resume_plan' | 'unchanged'

/** Structural equality of plain JSON (the order of an object's keys never matters: jsonb). */
function sameJson(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  return (
    aKeys.length === bKeys.length &&
    aKeys.every(
      (key) =>
        Object.hasOwn(b, key) &&
        sameJson((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
    )
  )
}

/** The built plan holds exactly the stored plan's blocks and snapshots: nothing to rebuild. */
function samePlan(stored: StoredPlan, built: DayPlan): boolean {
  return sameJson(stored.blocks, built.blocks) && sameJson(stored.tracks, built.tracks)
}

async function rebuildDay(supabase: Client, userId: string, day: Day): Promise<RebuildOutcome> {
  const read = await readPlan(supabase, userId, day.today)
  if (read === null) return 'no_plan'
  // A "Học tiếp hôm nay" plan is never rebuilt: buildPlan would advance the roadmap past the
  // stale items (§5.8).
  if ((await readPlanMode(supabase, userId, read.row.id)) === 'resume') return 'resume_plan'

  const plan = storable(buildPlan(await planContext(supabase, userId, day)))
  if (read.plan !== null && samePlan(read.plan, plan)) return 'unchanged'
  const { outcome } = await storePlan(createAdminClient(), userId, {
    eventId: crypto.randomUUID(),
    plan,
    mode: 'rebuild',
    expectedVersion: read.row.version,
  })
  return outcome === 'applied' ? 'rebuilt' : 'in_use'
}

/**
 * Rebuilds today's plan while it is untouched and not a resume plan (decision 11), after a
 * settings change (§5.4 "Settings changes", §2.3): with the current enrollments, at the stored
 * version (`version + 1`); `apply_system_event` refuses a plan in use (`plan_in_use`). A plan an
 * unreadable row holds is rebuilt too (M-4). Never throws an EventError: a failed rebuild leaves
 * the stored plan (the change applies tomorrow) — a `version_conflict` or `day_changed` is
 * retried once with a fresh clock (`withRetry`), then `in_use`.
 */
export async function rebuildTodayIfUntouched(
  userId: string,
  now: Date = new Date(),
): Promise<RebuildOutcome> {
  await assertSessionUser(userId)
  const supabase = await createClient()
  let tries = 0
  try {
    return await withRetry(async () => {
      // A retry reads the clock again when it starts: the day may have changed meanwhile.
      const day = await loadDay(supabase, userId, tries === 0 ? now : new Date())
      tries += 1
      return rebuildDay(supabase, userId, day)
    }, 2)
  } catch (error) {
    if (error instanceof EventError) return 'in_use'
    throw error
  }
}
