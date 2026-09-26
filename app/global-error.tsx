'use client'

import { ThemeProvider } from 'next-themes'
import { ErrorState } from '@/components/patterns/error-state'
import { vi } from '@/lib/i18n/vi'
import { mono, sans } from './fonts/fonts'
import './globals.css'

/**
 * Replaces the root layout when it fails, so it brings its own document, styles and fonts — and
 * its own `ThemeProvider` (M1 #17): the root layout's provider goes down with it, so without one
 * here a crash always rendered light, whatever theme the learner had saved. Same config as the
 * root layout's; its anti-flash inline script (next-themes) applies the saved class before paint.
 */
export default function GlobalError({
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return (
    <html lang="vi" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <title>{vi.states.globalErrorTitle}</title>
          <ErrorState
            layout="page"
            titleAs="h1"
            title={vi.states.globalErrorTitle}
            description={vi.states.globalErrorBody}
            onRetry={retry}
          />
        </ThemeProvider>
      </body>
    </html>
  )
}
