'use client'

import { ErrorState } from '@/components/patterns/error-state'

/** `/progress`'s own error boundary (task 5.5): `retry` re-renders the page. */
export default function ProgressError({
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return <ErrorState titleAs="h1" onRetry={retry} />
}
