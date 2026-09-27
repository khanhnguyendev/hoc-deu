'use client'

import { ErrorState } from '@/components/patterns/error-state'

/** `/review`'s own error boundary (task 5.3): `retry` re-renders the page. */
export default function ReviewError({
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return <ErrorState titleAs="h1" onRetry={retry} />
}
