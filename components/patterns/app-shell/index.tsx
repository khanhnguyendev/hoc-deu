import type * as React from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { vi } from '@/lib/i18n/vi'
import { BottomNav } from './bottom-nav'
import { Sidebar } from './sidebar'
import { TopBar } from './top-bar'

/**
 * The signed-in frame (DESIGN_SYSTEM §5): sidebar from 1024 px; top bar + bottom navigation below;
 * a skip link; `main#main` padded so nothing hides behind the bottom navigation, stacking the
 * page's sections with the section spacing (pages carry no classes of their own).
 */
function AppShell({
  user,
  isAdmin,
  title,
  onSignOut,
  children,
}: {
  user: { name: string }
  isAdmin: boolean
  /** Shown in the mobile top bar; the page still renders its own h1 (PageHeader). */
  title: string
  onSignOut?: () => void
  children: React.ReactNode
}) {
  return (
    <TooltipProvider>
      <div data-slot="app-shell" className="flex min-h-dvh bg-background">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2 focus:shadow-md"
        >
          {vi.common.skipToContent}
        </a>
        <Sidebar name={user.name} isAdmin={isAdmin} onSignOut={onSignOut} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar title={title} name={user.name} isAdmin={isAdmin} onSignOut={onSignOut} />
          <main
            id="main"
            tabIndex={-1}
            className="mx-auto flex w-full max-w-app flex-1 flex-col gap-6 px-4 pt-4 pb-above-bottom-nav md:gap-8 md:px-6 md:pt-6 lg:gap-10 lg:px-8 lg:pt-8 lg:pb-8"
          >
            {children}
          </main>
        </div>
        <BottomNav />
      </div>
    </TooltipProvider>
  )
}

export { AppShell }
