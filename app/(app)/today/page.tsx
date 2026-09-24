import { CalendarCheck } from 'lucide-react'
import type { Metadata } from 'next'
import { EmptyState } from '@/components/patterns/empty-state'
import { PageHeader } from '@/components/patterns/page-header'
import { vi } from '@/lib/i18n/vi'

export const metadata: Metadata = { title: `${vi.nav.today} — Học Đều` }

/** Placeholder (decision 13) until task 5.1's dashboard. */
export default function TodayPage() {
  return (
    <>
      <PageHeader title={vi.nav.today} />
      <EmptyState
        icon={CalendarCheck}
        title={vi.today.comingSoonTitle}
        description={vi.today.comingSoonBody}
      />
    </>
  )
}
