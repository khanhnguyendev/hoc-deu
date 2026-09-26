import type { Metadata } from 'next'
import { checkInBlock } from '@/features/checkin'
import { getToday, markPlanSeen, resumeTodayAction, todaySlots, TodayView } from '@/features/today'
import { vi } from '@/lib/i18n/vi'

export const metadata: Metadata = { title: `${vi.nav.today} — Học Đều` }

/** `?block=` when it is a single value: `getToday` opens that block's check-in sheet (§2.4). */
async function load({ searchParams }: PageProps<'/today'>) {
  const { block } = await searchParams
  return getToday(typeof block === 'string' ? block : undefined)
}

/**
 * `/today` (§2.4; tasks 5.1b, 5.2b): `getToday()` builds today's plan on the first visit while the
 * gate is open (decision 6) — a default prefetch stops at `loading.tsx` and never runs it — and
 * the page renders each block's rows through the registry (`todaySlots`). `/today?block=<id>`
 * opens that block's check-in sheet. The server actions go to the client leaves unbound
 * (`<MarkPlanSeen>` marks the plan seen in the browser, ADR-0039; the check-in components build
 * their `checkInBlock` input with the page's request ID).
 */
export default async function TodayPage(props: PageProps<'/today'>) {
  const page = await load(props)
  return (
    <TodayView
      page={page}
      slots={todaySlots(page)}
      markPlanSeen={markPlanSeen}
      resumeToday={resumeTodayAction}
      checkIn={checkInBlock}
    />
  )
}
