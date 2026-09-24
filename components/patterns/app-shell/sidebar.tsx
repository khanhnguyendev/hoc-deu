'use client'

import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { vi } from '@/lib/i18n/vi'
import { cn } from '@/lib/utils'
import { AccountMenu } from './account-menu'
import { ADMIN_ITEMS, isCurrent, NAV_ITEMS } from './nav-items'
import { SidebarLink } from './nav-link'

/** ≥ 1024 px: 240 px sidebar, collapsible to 64 px icons (DESIGN_SYSTEM §5). */
export function Sidebar({
  name,
  isAdmin,
  onSignOut,
}: {
  name: string
  isAdmin: boolean
  onSignOut?: () => void
}) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose

  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        'sticky top-0 hidden h-dvh shrink-0 flex-col gap-3 border-r border-border bg-surface p-3 lg:flex',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      <div
        className={cn('flex items-center gap-2', collapsed ? 'justify-center' : 'justify-between')}
      >
        {!collapsed && <span className="px-3 text-lg font-semibold">Học Đều</span>}
        <Button
          variant="ghost"
          size="icon"
          aria-expanded={!collapsed}
          aria-label={collapsed ? vi.nav.expand : vi.nav.collapse}
          onClick={() => setCollapsed((value) => !value)}
        >
          <ToggleIcon aria-hidden="true" strokeWidth={1.75} />
        </Button>
      </div>
      {/* The nav scrolls on short windows so the account menu below it stays reachable. */}
      <nav aria-label={vi.nav.main} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
        <ul role="list" className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <li key={item.href}>
              <SidebarLink item={item} current={isCurrent(item, pathname)} collapsed={collapsed} />
            </li>
          ))}
        </ul>
        {isAdmin && (
          <>
            <Separator />
            <ul role="list" className="flex flex-col gap-1">
              {ADMIN_ITEMS.map((item) => (
                <li key={item.href}>
                  <SidebarLink
                    item={item}
                    current={isCurrent(item, pathname)}
                    collapsed={collapsed}
                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </nav>
      <div className={cn('flex items-center gap-2', collapsed && 'justify-center')}>
        <AccountMenu name={name} isAdmin={isAdmin} onSignOut={onSignOut} />
        {!collapsed && <span className="truncate text-sm font-medium">{name}</span>}
      </div>
    </aside>
  )
}
