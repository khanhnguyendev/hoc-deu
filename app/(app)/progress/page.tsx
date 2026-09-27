import type { Metadata } from 'next'
import { getProgress, ProgressView } from '@/features/progress'
import { vi } from '@/lib/i18n/vi'

export const metadata: Metadata = { title: `${vi.nav.progress} — Học Đều` }

/** `?week=` when it is a single value; `getProgress` clamps it to a Monday not after this week. */
async function load({ searchParams }: PageProps<'/progress'>) {
  const { week } = await searchParams
  return getProgress(typeof week === 'string' ? week : undefined)
}

/**
 * Tiến độ (§2.4, §5.7, §5.9): the calendar heatmap over all history, the streak, this (or the
 * requested) week's summary and week navigation. Never a 404 (task 5.1c), so this segment keeps
 * its own `loading.tsx` and `error.tsx`.
 */
export default async function ProgressPage(props: PageProps<'/progress'>) {
  const page = await load(props)
  return <ProgressView page={page} />
}
