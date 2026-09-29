import type { Metadata } from 'next'
import { AdminOverview, getAdminOverview } from '@/features/admin'
import { vi } from '@/lib/i18n/vi'

export const metadata: Metadata = { title: `${vi.nav.admin} — Học Đều` }

/**
 * Quản trị (§2.4, §8.4 item 5; tasks 5.6, 6.4a): the warnings first — DB size, backup and
 * restore-test age, the red content-coverage warning, the deferred AI users of today's bot run —
 * then the counts, the system cards (the bot's last run among them) and links to `/admin/users`
 * and `/admin/content`. Only aggregate readers (§4.5). Replaces M2's `/admin` → `/admin/users`
 * redirect (ruling R12).
 */
export default async function AdminPage() {
  const page = await getAdminOverview()
  return <AdminOverview page={page} />
}
