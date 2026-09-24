'use client'

import Link from 'next/link'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { NavItem } from './nav-items'

/** A sidebar row: 44 px, icon + label; icon only (with a tooltip) when the sidebar is collapsed. */
export function SidebarLink({
  item,
  current,
  collapsed,
}: {
  item: NavItem
  current: boolean
  collapsed: boolean
}) {
  const { icon: Icon } = item
  const link = (
    <Link
      href={item.href}
      aria-current={current ? 'page' : undefined}
      className={cn(
        'relative flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors duration-(--duration-fast) ease-standard hover:bg-surface-muted hover:text-foreground',
        // Weight and a bar mark the current page, so it never relies on colour alone.
        current &&
          'bg-primary-soft font-semibold text-primary before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-full before:bg-primary hover:bg-primary-soft hover:text-primary',
        collapsed && 'justify-center px-0',
      )}
    >
      <Icon aria-hidden="true" strokeWidth={1.75} className="size-5 shrink-0" />
      <span className={cn(collapsed && 'sr-only')}>{item.label}</span>
    </Link>
  )
  if (!collapsed) return link
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  )
}
