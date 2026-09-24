import type * as React from 'react'
import { AppShell } from '@/components/patterns/app-shell'
import { requireOnboarded } from '@/lib/auth/dal'
import { vi } from '@/lib/i18n/vi'

/**
 * Active, onboarded users (§2.2): `/today`, and later `/review`, `/tracks`, `/t/…`, `/progress`,
 * `/settings`. The title stays "Học Đều" until task 2.7b derives it from the path (ruling R3);
 * 2.7b also wires sign-out.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireOnboarded()
  return (
    <AppShell
      user={{ name: user.displayName ?? user.email ?? vi.nav.account }}
      isAdmin={user.isAdmin}
      title="Học Đều"
    >
      {children}
    </AppShell>
  )
}
