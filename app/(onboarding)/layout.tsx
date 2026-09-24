import { redirect } from 'next/navigation'
import type * as React from 'react'
import { requireActive } from '@/lib/auth/dal'

/** Approved users who have not onboarded yet (§2.2): `/onboarding`; onboarded users → `/today`. */
export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const user = await requireActive()
  if (user.onboardedAt) redirect('/today')
  return children
}
