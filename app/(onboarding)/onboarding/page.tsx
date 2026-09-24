import { Compass } from 'lucide-react'
import type { Metadata } from 'next'
import { EmptyState } from '@/components/patterns/empty-state'
import { FocusLayout } from '@/components/patterns/focus-layout'
import { PageHeader } from '@/components/patterns/page-header'
import { vi } from '@/lib/i18n/vi'

export const metadata: Metadata = { title: `${vi.onboarding.pageTitle} — Học Đều` }

/** Placeholder (decision 13) until task 2.10's onboarding wizard. */
export default function OnboardingPage() {
  return (
    <FocusLayout width="wide">
      <PageHeader title={vi.onboarding.title} description={vi.onboarding.description} />
      <EmptyState
        icon={Compass}
        title={vi.onboarding.comingSoonTitle}
        description={vi.onboarding.comingSoonBody}
      />
    </FocusLayout>
  )
}
