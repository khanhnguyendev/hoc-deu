'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireOnboarded } from '@/lib/auth/dal'
import { EventError } from '@/lib/events/apply'
import { vi } from '@/lib/i18n/vi'
import { addExtraForTrack, type ExtraOutcome } from '@/lib/plans/extra'
import { resumeToday, type ResumeOutcome } from '@/lib/plans/resume'
import { createClient } from '@/lib/supabase/server'

const PATH = '/today'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * <MarkPlanSeen>'s action (§5.2, ADR-0039): mark_plan_seen for the caller's own plan. Called from
 * the browser effect once `/today` has rendered the plan, never from a render; the RPC sets
 * `seen_at` once and only on the caller's own plan (`auth.uid()`). An id that is not a UUID sends
 * nothing. A failed RPC is logged — its code and message only, never the plan id — and the action
 * returns: the plan stays unseen, and the next render of `/today` marks it again.
 */
export async function markPlanSeen(planId: string): Promise<void> {
  await requireOnboarded()
  if (typeof planId !== 'string' || !UUID.test(planId)) return
  const supabase = await createClient()
  const { error } = await supabase.rpc('mark_plan_seen', { p_plan_id: planId })
  if (error) {
    console.error('[today] mark_plan_seen failed:', `${error.code ?? 'unknown'} ${error.message}`)
  }
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

export type ExtraResult = { readonly ok: boolean; readonly message: string }

const EXTRA_RESULTS = {
  added: { ok: true, message: vi.extra.add.added },
  nothing_to_add: { ok: false, message: vi.extra.add.nothingToAdd },
  // The page showed "Học thêm", so the plan changed since it rendered: throttled to 0 (its
  // throttled notice replaces the button, `ExtraButton`), paused, or not built yet.
  throttled: { ok: false, message: vi.extra.add.stale },
  no_plan: { ok: false, message: vi.extra.add.stale },
} as const satisfies Record<ExtraOutcome, ExtraResult>

const extraInputSchema = z.strictObject({
  requestId: z.uuid(),
  /** The database's rule for track ids (`user_tracks.track_id`). */
  trackId: z.string().regex(/^[a-z][a-z0-9-]{0,31}$/),
})

/**
 * "Học thêm" (decision 20, §5.9): `addExtraForTrack` with the page's per-render request id — a
 * double tap in one render adds once (`extra:<planId>:<trackId>`, decision 16) — then
 * revalidatePath('/today'), whatever the outcome: the extra block appears, or the page shows what
 * changed. An EventError becomes its Vietnamese message; any other error reaches the route's
 * error boundary.
 */
export async function addExtraAction(input: {
  requestId: string
  trackId: string
}): Promise<ExtraResult> {
  const user = await requireOnboarded()
  const parsed = extraInputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: vi.extra.add.invalid }
  const { requestId, trackId } = parsed.data
  let result: ExtraResult
  try {
    result = EXTRA_RESULTS[await addExtraForTrack(user.id, trackId, requestId)]
  } catch (error) {
    if (!(error instanceof EventError)) throw error
    result = { ok: false, message: error.userMessage }
  }
  revalidatePath(PATH)
  return result
}
