import 'server-only'
import { buildResumePlan } from '@/lib/domain/plan/resume'
import { withRetry } from '@/lib/events/apply'
import { storePlan } from '@/lib/events/plans'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { loadDay, planContext, resolveDay, storable } from './day'
import { assertSessionUser } from './session'

export type ResumeOutcome = 'created' | 'exists' | 'not_offered'

/**
 * "Học tiếp hôm nay" (§5.8): only while the gate is closed and offerResume. Repeats `ensureToday`'s
 * steps 1–4, then builds today's plan from the stale plan's unfinished new items and today's due
 * reviews (`buildResumePlan`), validated (decision 10) and stored as `plan.generated { mode:
 * 'resume' }` with a random event id (decision 8): `created`, or `exists` when the date already
 * has a plan (a double tap, another tab). A request that crosses the day start (`day_changed`)
 * runs again with a fresh clock (`withRetry`, RF-1); every other state is `not_offered`.
 */
export async function resumeToday(userId: string, now: Date = new Date()): Promise<ResumeOutcome> {
  await assertSessionUser(userId)
  const supabase = await createClient()
  let tries = 0
  return withRetry(async () => {
    // A retry reads the clock again when it starts: the day may have changed meanwhile.
    const day = await loadDay(supabase, userId, tries === 0 ? now : new Date())
    tries += 1
    const resolution = await resolveDay(supabase, userId, day)
    if (resolution.kind !== 'paused' || !resolution.offerResume) return 'not_offered'

    const ctx = await planContext(supabase, userId, day)
    const plan = storable(buildResumePlan(ctx, resolution.plan))
    const { outcome } = await storePlan(createAdminClient(), userId, {
      eventId: crypto.randomUUID(),
      plan,
      mode: 'resume',
      expectedVersion: 0,
    })
    switch (outcome) {
      case 'applied':
        return 'created'
      case 'plan_exists':
      case 'duplicate':
        return 'exists'
      case 'plan_in_use':
        // Only a rebuild can be refused as in use.
        throw new Error('resumeToday: a resume plan was refused as in use')
    }
  })
}
