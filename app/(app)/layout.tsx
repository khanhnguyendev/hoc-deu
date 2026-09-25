import type * as React from 'react'
import { AppShell } from '@/components/patterns/app-shell'
import { signOut } from '@/features/auth'
import { requireOnboarded } from '@/lib/auth/dal'
import { vi } from '@/lib/i18n/vi'

/**
 * Active, onboarded users (§2.2): `/today`, and later `/review`, `/tracks`, `/t/…`, `/progress`,
 * `/settings`. The top bar's title is derived from the path (R3); sign-out redirects to
 * `/sign-in`.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireOnboarded()
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
