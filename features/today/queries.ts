import 'server-only'
import { activityWindowStart } from '@/features/progress'
import { requireOnboarded } from '@/lib/auth/dal'
import { readDailyActivity } from '@/lib/plans/reads'
import { ensureToday } from '@/lib/plans/today'
import { createClient } from '@/lib/supabase/server'
import { buildTodayPage, type TodayPage } from './view-model'

/**
 * `/today`'s loader (§2.4, §5.4; decisions 6, 7, 16): requireOnboarded → ensureToday (which may
 * build and store today's plan — never marks it seen, ADR-0039) → `daily_activity` over the streak's
 * window, the one `/progress` reads too (`activityWindowStart`, m-7), through the session client
 * (RLS) → buildTodayPage with a fresh per-render request id. `block`
 * is `?block=` (task 5.2b): the check-in sheet opens for it when the dashboard shows that block.
 */
export async function getToday(block?: string): Promise<TodayPage> {
  const user = await requireOnboarded()
  const data = await ensureToday(user.id)
  const supabase = await createClient()
  const activity = await readDailyActivity(supabase, user.id, activityWindowStart(data.today))
  return buildTodayPage(data, activity, crypto.randomUUID(), block)
}
