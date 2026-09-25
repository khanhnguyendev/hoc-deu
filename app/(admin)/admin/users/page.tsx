import type { Metadata } from 'next'
import { PageHeader } from '@/components/patterns/page-header'
import { listUsers, setUserRole, setUserStatus, UserQueue } from '@/features/admin'
import { vi } from '@/lib/i18n/vi'

export const metadata: Metadata = { title: `${vi.nav.adminUsers} — Học Đều` }

/** The approval queue (§2.4): approve, reject, suspend, reactivate, promote and demote. */
export default async function AdminUsersPage() {
  const users = await listUsers()
  return (
    <>
      <PageHeader title={vi.nav.adminUsers} />
      <UserQueue users={users} setUserStatus={setUserStatus} setUserRole={setUserRole} />
    </>
  )
}
