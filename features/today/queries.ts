import 'server-only'
import { requireOnboarded } from '@/lib/auth/dal'
import { addDays } from '@/lib/domain/time/localDay'
import { readDailyActivity } from '@/lib/plans/reads'
import { ensureToday } from '@/lib/plans/today'
import { createClient } from '@/lib/supabase/server'
import { buildTodayPage, type TodayPage } from './view-model'

/** How far back `/today` reads `daily_activity` for the streak (Part B-M5 decision 7). */
const ACTIVITY_DAYS = 400

/**
 * `/today`'s loader (§2.4, §5.4; decisions 6, 7, 16): requireOnboarded → ensureToday (which may
 * build and store today's plan — never marks it seen, ADR-0039) → 400 days of `daily_activity`
 * through the session client (RLS) → buildTodayPage with a fresh per-render request id.
 */
export async function getToday(): Promise<TodayPage> {
  const user = await requireOnboarded()
  const data = await ensureToday(user.id)
  const supabase = await createClient()
  const activity = await readDailyActivity(supabase, user.id, addDays(data.today, -ACTIVITY_DAYS))
  return buildTodayPage(data, activity, crypto.randomUUID())
}
