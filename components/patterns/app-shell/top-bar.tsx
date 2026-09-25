'use client'

import { usePathname } from 'next/navigation'
import { ADMIN_ITEMS, isCurrent, NAV_ITEMS } from './nav-items'
import { AccountMenu } from './account-menu'

/** The current nav item's label, or the "Học Đều" wordmark when the path matches none (R3). */
function titleFor(pathname: string): string {
  const item = [...NAV_ITEMS, ...ADMIN_ITEMS].find((entry) => isCurrent(entry, pathname))
  return item?.label ?? 'Học Đều'
}

/** < 1024 px: sticky bar with the page title, derived from the path, and the account menu (§5). */
export function TopBar({
  name,
  isAdmin,
  onSignOut,
}: {
  name: string
  isAdmin: boolean
  onSignOut?: () => Promise<void>
}) {
  const pathname = usePathname()
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border bg-surface px-4 md:px-6 lg:hidden">
      <p className="truncate text-lg font-semibold">{titleFor(pathname)}</p>
      <AccountMenu name={name} isAdmin={isAdmin} onSignOut={onSignOut} />
    </header>
  )
}
