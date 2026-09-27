import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { StoredPlan } from '@/lib/domain/plan/types'
import type { BlockState } from '@/lib/domain/state'
import type { LocalDay } from '@/lib/domain/time/localDay'
import type { Database } from '@/lib/supabase/database.types'
import { planCatalog } from './catalog'
import { gateState, trackState } from './day'
import { readBlockStates, readEnrollments, readPlan } from './reads'
import { assertSessionUser } from './session'

type Client = SupabaseClient<Database>

export type CurrentPlan = {
  readonly kind: 'today' | 'paused' | 'resumed'
  readonly plan: StoredPlan
  readonly blocks: Readonly<Record<string, BlockState>>
}

/**
 * The plan check-ins and results go to (decision 13): today's plan; else the last seen plan when
 * the gate is closed or resumed today; else null (today's plan is not built yet). Builds nothing.
 * `/today`'s steps with the caller's `today` and active tracks (M-5 A), so it never names a plan
 * `/today` does not show: an unreadable today's plan gives null (check-ins and results are
 * refused as stale while `/today` shows its error state), and so do no active track or every
 * active track starting later (`noTracks`, `notStarted`) — even with a closed gate.
 */
export async function currentPlan(
  supabase: Client,
  userId: string,
  today: LocalDay,
  activeTrackIds: ReadonlySet<string>,
): Promise<CurrentPlan | null> {
  await assertSessionUser(userId)
  const read = await readPlan(supabase, userId, today)
  if (read !== null) {
    if (read.plan === null) return null
    return {
      kind: 'today',
      plan: read.plan,
      blocks: await readBlockStates(supabase, [read.plan.id]),
    }
  }
  if (activeTrackIds.size === 0) return null
  const enrollments = await readEnrollments(supabase, userId, planCatalog())
  const active = enrollments.filter((enrollment) => activeTrackIds.has(enrollment.trackId))
  if (trackState(active, today) !== null) return null
  const gate = await gateState(supabase, userId, today, activeTrackIds)
  return gate === null ? null : { kind: gate.kind, plan: gate.plan, blocks: gate.blocks }
}
