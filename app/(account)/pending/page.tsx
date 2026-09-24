import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { FocusLayout } from '@/components/patterns/focus-layout'
import { PendingStatus, SignOutButton, StatusWatcher, signOut } from '@/features/auth'
import { requireUser } from '@/lib/auth/dal'
import { homePathFor } from '@/lib/auth/paths'
import { vi } from '@/lib/i18n/vi'

export const metadata: Metadata = { title: `${vi.nav.account} — Học Đều` }

/**
 * The status screen (§2.4): the copy for the account's status, a sign-out button and a
 * `StatusWatcher` that refreshes the page until an admin approves it. An active account has
 * nothing to wait for and goes home.
 */
export default async function PendingPage() {
  const user = await requireUser()
  if (user.status === 'active') redirect(homePathFor(user))
  return (
    <FocusLayout headerActions={<SignOutButton signOut={signOut} />}>
      <PendingStatus status={user.status} />
      <StatusWatcher />
    </FocusLayout>
  )
}
