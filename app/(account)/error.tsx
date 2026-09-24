'use client'

import { ErrorState } from '@/components/patterns/error-state'
import { FocusLayout } from '@/components/patterns/focus-layout'

/** Error boundary of the `(account)` group (§7.5): Next 16's `retry` re-renders the segment. */
export default function AccountError({
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return (
    <FocusLayout>
      <ErrorState titleAs="h1" onRetry={retry} />
    </FocusLayout>
  )
}
