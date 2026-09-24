'use client'

import { ErrorState } from '@/components/patterns/error-state'

/** Error boundary of the `(app)` group (§7.5), inside the AppShell: `retry` re-renders the page. */
export default function AppError({
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return <ErrorState titleAs="h1" onRetry={retry} />
}
