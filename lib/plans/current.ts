import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { StoredPlan } from '@/lib/domain/plan/types'
import type { BlockState } from '@/lib/domain/state'
import type { LocalDay } from '@/lib/domain/time/localDay'
import type { Database } from '@/lib/supabase/database.types'
import { gateState } from './day'
import { readBlockStates, readPlan } from './reads'
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
 * §5.4 steps 1, 2 and 4 with the caller's `today` and active tracks (M-5 A): an unreadable
 * today's plan gives null — check-ins and results are refused as stale while `/today` shows its
 * error state.
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
  const gate = await gateState(supabase, userId, today, activeTrackIds)
  return gate === null ? null : { kind: gate.kind, plan: gate.plan, blocks: gate.blocks }
}
