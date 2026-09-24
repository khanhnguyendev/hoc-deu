import Link from 'next/link'
import type * as React from 'react'
import { vi } from '@/lib/i18n/vi'
import { cn } from '@/lib/utils'

const WIDTH = { narrow: 'max-w-md', wide: 'max-w-2xl' } as const

/**
 * The frame for pages outside the AppShell (`/`, `/sign-in`, `/pending`, `/onboarding`): a skip
 * link, a header with the wordmark and optional actions, and a centred `main#main`
 * (DESIGN_SYSTEM §5 page gutters).
 */
function FocusLayout({
  children,
  width = 'narrow',
  headerActions,
}: {
  children: React.ReactNode
  width?: keyof typeof WIDTH
  headerActions?: React.ReactNode
}) {
  return (
    <div data-slot="focus-layout" className="flex min-h-dvh flex-col bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2 focus:shadow-md"
      >
        {vi.common.skipToContent}
      </a>
      <header className="flex items-center justify-between px-4 py-4 md:px-6 lg:px-8">
        <Link href="/" className="text-lg font-semibold text-foreground">
          Học Đều
        </Link>
        {headerActions && <div className="flex items-center gap-2">{headerActions}</div>}
      </header>
      <main
        id="main"
        tabIndex={-1}
        className={cn(
          'mx-auto flex w-full flex-1 flex-col justify-center px-4 py-8 md:px-6 lg:px-8',
          WIDTH[width],
        )}
      >
        {children}
      </main>
    </div>
  )
}

export { FocusLayout }
