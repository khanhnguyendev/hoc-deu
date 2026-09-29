import type * as React from 'react'
import { AppShell } from '@/components/patterns/app-shell'
import { signOut } from '@/features/auth'
import { requireAdmin } from '@/lib/auth/dal'
import { vi } from '@/lib/i18n/vi'

/**
 * Active admins (§2.2, §2.4): the `/admin` overview, `/admin/users` and `/admin/content` (task
 * 5.6), `/admin/bot` (task 6.3). Anyone else gets the 404, so admin routes are not advertised.
 * Admin pages need no onboarding: a bootstrapped admin can approve accounts before choosing tracks.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin()
  return (
    <AppShell
      user={{ name: user.displayName ?? user.email ?? vi.nav.account }}
      isAdmin={user.isAdmin}
      onSignOut={signOut}
    >
      {children}
    </AppShell>
  )
}
