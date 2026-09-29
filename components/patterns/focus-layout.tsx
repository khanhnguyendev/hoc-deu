import Link from 'next/link'
import type * as React from 'react'
import { Toaster } from '@/components/ui/toaster'
import { vi } from '@/lib/i18n/vi'
import { cn } from '@/lib/utils'
import { LogoMark } from './logo-mark'

/** `page`: the landing's wide frame (DESIGN_SYSTEM §15) — sections start at the top, not centred. */
const WIDTH = {
  narrow: 'max-w-md justify-center',
  wide: 'max-w-2xl justify-center',
  page: 'max-w-6xl',
} as const

/**
 * The frame for pages outside the AppShell (`/`, `/sign-in`, `/pending`, `/onboarding`): a skip
 * link, a header with the wordmark and optional actions, and a `main#main` (centred; `width="page"` starts at the top) that stacks the
 * page's sections with the section spacing (DESIGN_SYSTEM §5 page gutters and section spacing).
 * It mounts the Toaster of these pages, as the AppShell does for the signed-in ones (task 5.6):
 * layouts and pages may not import `components/ui`. `toaster={false}` leaves it out where the
 * page already has one (the component catalog) — two Toasters would show every toast twice.
 */
function FocusLayout({
  children,
  width = 'narrow',
  headerActions,
  toaster = true,
}: {
  children: React.ReactNode
  width?: keyof typeof WIDTH
  headerActions?: React.ReactNode
  toaster?: boolean
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
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <LogoMark />
          Học Đều
        </Link>
        {headerActions && <div className="flex items-center gap-2">{headerActions}</div>}
      </header>
      <main
        id="main"
        tabIndex={-1}
        className={cn(
          'mx-auto flex w-full flex-1 flex-col gap-6 px-4 py-8 md:gap-8 md:px-6 lg:gap-10 lg:px-8',
          WIDTH[width],
        )}
      >
        {children}
      </main>
      {toaster && <Toaster />}
    </div>
  )
}

export { FocusLayout }
