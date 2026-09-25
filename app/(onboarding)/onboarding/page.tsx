import type { Metadata } from 'next'
import { FocusLayout } from '@/components/patterns/focus-layout'
import { PageHeader } from '@/components/patterns/page-header'
import { completeOnboarding, getOnboardingData, OnboardingWizard } from '@/features/onboarding'
import { vi } from '@/lib/i18n/vi'

export const metadata: Metadata = { title: `${vi.onboarding.pageTitle} — Học Đều` }

/**
 * The onboarding wizard (§2.4): tracks, minutes, roadmap variant, schedule, code language and the
 * weekly template preview, completed through events. The layout already sends onboarded users to
 * `/today`; each render brings a fresh `requestId` (decision 9).
 */
export default async function OnboardingPage() {
  const data = await getOnboardingData()
  return (
    <FocusLayout width="wide">
      <PageHeader title={vi.onboarding.title} description={vi.onboarding.description} />
      <OnboardingWizard {...data} action={completeOnboarding} />
    </FocusLayout>
  )
}
