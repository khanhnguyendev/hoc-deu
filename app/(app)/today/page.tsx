import type { Metadata } from 'next'
import { getToday, markPlanSeen, resumeTodayAction, todaySlots, TodayView } from '@/features/today'
import { vi } from '@/lib/i18n/vi'

export const metadata: Metadata = { title: `${vi.nav.today} — Học Đều` }

/**
 * `/today` (§2.4; task 5.1b): `getToday()` builds today's plan on the first visit while the gate
 * is open (decision 6) — a default prefetch stops at `loading.tsx` and never runs it — and the
 * page renders each block's rows through the registry (`todaySlots`). The server actions go to
 * the client leaves unbound (`<MarkPlanSeen>` marks the plan seen in the browser, ADR-0039).
 */
export default async function TodayPage() {
  const page = await getToday()
  return (
    <TodayView
      page={page}
      slots={todaySlots(page)}
      markPlanSeen={markPlanSeen}
      resumeToday={resumeTodayAction}
    />
  )
}
