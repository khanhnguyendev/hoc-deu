import { vi } from '@/lib/i18n/vi'
import { cn } from '@/lib/utils'

/**
 * "Bước {n}/{total}: {label}" as visible text, plus an `<ol>` of step dots
 * (DESIGN_SYSTEM §5 forms). Never colour alone: the current dot is larger and the step label is
 * text, not just colour.
 */
function StepIndicator({
  steps,
  current,
  className,
}: {
  steps: readonly string[]
  /** 0-based. */
  current: number
  className?: string
}) {
  const total = steps.length
  const label = steps[current] ?? ''
  return (
    <div data-slot="step-indicator" className={cn('flex flex-col gap-2', className)}>
      <p className="text-sm font-medium text-foreground">
        {vi.forms.step} {current + 1}/{total}: {label}
      </p>
      <ol className="flex items-center gap-2">
        {steps.map((step, index) => {
          const isCurrent = index === current
          return (
            <li key={step} aria-current={isCurrent ? 'step' : undefined}>
              <span
                aria-hidden="true"
                className={cn(
                  'block rounded-full bg-border-strong',
                  isCurrent ? 'size-3 bg-primary' : 'size-2',
                )}
              />
              <span className="sr-only">{step}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export { StepIndicator }
