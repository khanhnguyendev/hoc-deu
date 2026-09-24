import { CircleAlert, Info, type LucideIcon, TriangleAlert } from 'lucide-react'
import type * as React from 'react'
import { cn } from '@/lib/utils'

const TONES: Record<'warning' | 'danger' | 'info', { icon: LucideIcon; classes: string }> = {
  warning: { icon: TriangleAlert, classes: 'bg-warning-soft text-warning-soft-foreground' },
  danger: { icon: CircleAlert, classes: 'bg-danger-soft text-danger-soft-foreground' },
  info: { icon: Info, classes: 'bg-primary-soft text-primary-soft-foreground' },
}

/**
 * Icon + one sentence + one action (DESIGN_SYSTEM §9): paused roadmap and throttle use `warning`,
 * red admin warnings use `danger`.
 */
function Banner({
  tone,
  action,
  children,
  className,
}: {
  tone: keyof typeof TONES
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  const { icon: Icon, classes } = TONES[tone]
  return (
    <div
      data-slot="banner"
      data-tone={tone}
      className={cn(
        'flex flex-col gap-3 rounded-lg px-4 py-3 text-sm sm:flex-row sm:items-center',
        classes,
        className,
      )}
    >
      <div className="flex flex-1 items-start gap-2">
        <Icon aria-hidden="true" strokeWidth={1.75} className="mt-0.5 size-4 shrink-0" />
        <p>{children}</p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export { Banner }
