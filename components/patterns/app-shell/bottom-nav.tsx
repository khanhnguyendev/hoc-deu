'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { vi } from '@/lib/i18n/vi'
import { cn } from '@/lib/utils'
import { isCurrent, NAV_ITEMS } from './nav-items'

/** < 1024 px: five items, icon + label, 56 px plus the safe-area inset (DESIGN_SYSTEM §5). */
export function BottomNav() {
  const pathname = usePathname()
  return (
    <nav
      aria-label={vi.nav.main}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface pb-safe-bottom lg:hidden"
    >
      <ul role="list" className="grid h-14 grid-cols-5">
        {NAV_ITEMS.map((item) => {
          const current = isCurrent(item, pathname)
          const { icon: Icon } = item
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  'relative flex h-full flex-col items-center justify-center gap-0.5 text-xs font-medium text-muted-foreground',
                  // Weight and a bar mark the current page, so it never relies on colour alone.
                  current &&
                    'bg-primary-soft font-semibold text-primary before:absolute before:inset-x-4 before:top-0 before:h-1 before:rounded-full before:bg-primary',
                )}
              >
                <Icon aria-hidden="true" strokeWidth={1.75} className="size-6" />
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
