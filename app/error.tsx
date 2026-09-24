'use client'

import { ErrorState } from '@/components/patterns/error-state'

/** Route error boundary (Next 16: `retry` re-fetches and re-renders the segment). */
export default function RouteError({
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return <ErrorState layout="page" titleAs="h1" onRetry={retry} />
}
