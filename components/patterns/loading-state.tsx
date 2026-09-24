import { Skeleton } from '@/components/ui/skeleton'
import { vi } from '@/lib/i18n/vi'

/**
 * Skeletons shaped like the content, never a full-page spinner (DESIGN_SYSTEM §9). The status
 * text is for screen readers; the skeletons are hidden from them.
 */
function LoadingState({
  variant = 'list',
  rows = 3,
}: {
  variant?: 'list' | 'card' | 'page'
  rows?: number
}) {
  const indices = Array.from({ length: rows }, (_, i) => i)
  return (
    <div data-slot="loading-state" role="status" className="flex w-full flex-col gap-3">
      <span className="sr-only">{vi.common.loading}</span>
      {variant === 'page' && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-5 w-1/3" />
        </div>
      )}
      {variant === 'list' && indices.map((i) => <Skeleton key={i} className="h-11 w-full" />)}
      {(variant === 'card' || variant === 'page') && (
        <div className="grid gap-3 md:grid-cols-2 md:gap-4">
          {indices.map((i) => (
            <div key={i} className="flex flex-col gap-3 rounded-lg border border-border p-4 md:p-5">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export { LoadingState }
