'use client'

import { useRouter } from 'next/navigation'
import { ErrorState } from '@/components/patterns/error-state'
import { vi } from '@/lib/i18n/vi'

const copy = vi.today.empty.unreadable

/**
 * Today's stored plan cannot be read and is already in use, so it was not rebuilt (M-4, decision
 * 10): the error state says so, and "Thử lại" (DESIGN_SYSTEM §9) renders `/today` again —
 * `ensureToday` reads, and when it can, rebuilds the plan once more. The copy never promises the
 * plan repairs itself; it says what to do when it keeps failing (M5-R26). A client leaf: the
 * retry is `router.refresh()`.
 */
function UnreadablePlan() {
  const router = useRouter()
  return (
    <ErrorState
      title={copy.title}
      description={copy.description}
      onRetry={() => router.refresh()}
    />
  )
}

export { UnreadablePlan }
