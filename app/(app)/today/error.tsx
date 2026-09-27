'use client'

import { ErrorState } from '@/components/patterns/error-state'
import { vi } from '@/lib/i18n/vi'

/**
 * `/today`'s error boundary (§7.5): the plan could not be loaded or built (a read failed, or the
 * local day changed under every attempt — decision 9). `retry` re-renders the page, which runs
 * `ensureToday` again.
 */
export default function TodayError({
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return <ErrorState titleAs="h1" title={vi.today.error.title} onRetry={retry} />
}
