'use client'

import { ErrorState } from '@/components/patterns/error-state'
import { vi } from '@/lib/i18n/vi'
import { mono, sans } from './fonts/fonts'
import './globals.css'

/** Replaces the root layout when it fails, so it brings its own document, styles and fonts. */
export default function GlobalError({
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return (
    <html lang="vi" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <title>{vi.states.globalErrorTitle}</title>
        <ErrorState
          layout="page"
          titleAs="h1"
          title={vi.states.globalErrorTitle}
          description={vi.states.globalErrorBody}
          onRetry={retry}
        />
      </body>
    </html>
  )
}
