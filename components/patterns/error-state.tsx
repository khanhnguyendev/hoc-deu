import { CircleAlert, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { vi } from '@/lib/i18n/vi'
import { cn } from '@/lib/utils'
import { StateFrame, type StateLayout } from './empty-state'

/** What failed + "Thử lại" (DESIGN_SYSTEM §9). */
function ErrorState({
  title = vi.states.errorTitle,
  description = vi.states.errorBody,
  onRetry,
  titleAs: Title = 'h2',
  layout = 'inline',
  className,
}: {
  title?: string
  description?: string
  onRetry?: () => void
  titleAs?: 'h1' | 'h2' | 'h3'
  layout?: StateLayout
  className?: string
}) {
  return (
    <StateFrame layout={layout}>
      <div
        data-slot="error-state"
        role="alert"
        className={cn(
          'flex w-full flex-col items-center gap-3 rounded-lg border border-border bg-danger-soft px-4 py-10 text-center text-danger-soft-foreground',
          className,
        )}
      >
        <CircleAlert aria-hidden="true" strokeWidth={1.75} className="size-8" />
        <Title className="text-lg font-semibold">{title}</Title>
        <p className="max-w-prose text-sm">{description}</p>
        {onRetry && (
          <Button variant="outline" onClick={onRetry}>
            <RotateCcw aria-hidden="true" strokeWidth={1.75} />
            {vi.common.retry}
          </Button>
        )}
      </div>
    </StateFrame>
  )
}

export { ErrorState }
