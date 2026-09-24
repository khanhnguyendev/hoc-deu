import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { FocusLayout } from '@/components/patterns/focus-layout'
import { PageHeader } from '@/components/patterns/page-header'
import { requireUser } from '@/lib/auth/dal'
import { homePathFor } from '@/lib/auth/paths'
import { vi } from '@/lib/i18n/vi'

export const metadata: Metadata = { title: `${vi.nav.account} — Học Đều` }

/**
 * Placeholder (decision 13) until task 2.7b's status screen: the copy for the account's status.
 * An active account has nothing to wait for and goes home.
 */
export default async function PendingPage() {
  const user = await requireUser()
  if (user.status === 'active') redirect(homePathFor(user))
  const copy = vi.account[user.status]
  return (
    <FocusLayout>
      <PageHeader title={copy.title} description={copy.description} />
    </FocusLayout>
  )
}
