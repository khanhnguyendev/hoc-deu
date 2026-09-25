import type { Metadata } from 'next'
import { requireDevAccess } from '@/lib/auth/dal'
import { AppShellDemo } from './demo'

export const metadata: Metadata = { title: 'AppShell — Học Đều' }

/** Like /dev/components: open in development and on previews, admin-only in production (§2.4). */
export default async function AppShellPage() {
  await requireDevAccess()
  return <AppShellDemo />
}
