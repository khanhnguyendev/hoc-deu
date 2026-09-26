'use server'

import { revalidatePath } from 'next/cache'
import { requireOnboarded } from '@/lib/auth/dal'
import { EventError } from '@/lib/events/apply'
import { vi } from '@/lib/i18n/vi'
import { resumeToday, type ResumeOutcome } from '@/lib/plans/resume'
import { createClient } from '@/lib/supabase/server'

const PATH = '/today'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * <MarkPlanSeen>'s action (§5.2, ADR-0039): mark_plan_seen for the caller's own plan. Called from
 * the browser effect once `/today` has rendered the plan, never from a render; the RPC sets
 * `seen_at` once and only on the caller's own plan (`auth.uid()`). An id that is not a UUID sends
 * nothing; a failed RPC throws (the effect may retry on the next render).
 */
export async function markPlanSeen(planId: string): Promise<void> {
  await requireOnboarded()
  if (typeof planId !== 'string' || !UUID.test(planId)) return
  const supabase = await createClient()
  const { error } = await supabase.rpc('mark_plan_seen', { p_plan_id: planId })
  if (error) throw new Error('Could not mark the plan seen', { cause: error })
}

export type ResumeResult = { readonly ok: boolean; readonly message: string }

const RESULTS = {
  created: { ok: true, message: vi.today.resumeResult.created },
  exists: { ok: true, message: vi.today.resumeResult.exists },
  not_offered: { ok: false, message: vi.today.resumeResult.notOffered },
} as const satisfies Record<ResumeOutcome, ResumeResult>

/**
 * "Học tiếp hôm nay" (§5.8): resumeToday, then revalidatePath('/today') — whatever the outcome,
 * `/today` re-renders with the current state (the new plan, or the gate another tab opened). An
 * EventError becomes its Vietnamese message; any other error reaches the route's error boundary.
 */
export async function resumeTodayAction(): Promise<ResumeResult> {
  const user = await requireOnboarded()
  let result: ResumeResult
  try {
    result = RESULTS[await resumeToday(user.id)]
  } catch (error) {
    if (!(error instanceof EventError)) throw error
    result = { ok: false, message: error.userMessage }
  }
  revalidatePath(PATH)
  return result
}
