import { cva } from 'class-variance-authority'
import {
  Check,
  Circle,
  CircleCheck,
  CircleDot,
  Clock,
  type LucideIcon,
  SkipForward,
  Star,
  TriangleAlert,
} from 'lucide-react'
import { vi } from '@/lib/i18n/vi'
import { cn } from '@/lib/utils'

/** Item status (spaced repetition) and plan-block status (check-in), DESIGN_SYSTEM §3.3. */
type PillStatus =
  | 'not-started'
  | 'weak'
  | 'ok'
  | 'strong'
  | 'mastered'
  | 'skipped'
  | 'block-done'
  | 'block-partial'
  | 'block-skipped'

/** Colour, icon and label always travel together: status is never colour alone. */
const STATUS_PILL: Record<PillStatus, { label: string; icon: LucideIcon; classes: string }> = {
  'not-started': {
    label: vi.status.notStarted,
    icon: Circle,
    classes: 'border border-dashed border-border-strong bg-surface-sunken text-muted-foreground',
  },
  weak: {
    label: vi.status.weak,
    icon: TriangleAlert,
    classes: 'bg-danger-soft text-danger-soft-foreground',
  },
  ok: { label: vi.status.ok, icon: CircleDot, classes: 'bg-surface-muted text-foreground' },
  strong: {
    label: vi.status.strong,
    icon: CircleCheck,
    classes: 'bg-success-soft text-success-soft-foreground',
  },
  mastered: {
    label: vi.status.mastered,
    icon: Star,
    classes: 'bg-primary-soft text-primary-soft-foreground',
  },
  skipped: {
    label: vi.status.skipped,
    icon: SkipForward,
    classes: 'bg-surface-muted text-muted-foreground',
  },
  'block-done': {
    label: vi.block.done,
    icon: Check,
    classes: 'bg-success text-success-foreground',
  },
  'block-partial': {
    label: vi.block.partial,
    icon: Clock,
    classes: 'bg-warning text-warning-foreground',
  },
  'block-skipped': {
    label: vi.block.skipped,
    icon: SkipForward,
    classes: 'bg-surface-muted text-muted-foreground',
  },
}

const pillVariants = cva(
  'inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full text-xs font-medium whitespace-nowrap',
  {
    variants: {
      /** `sm`: 24 px, not tappable. `md`: 32 px, filter chips. */
      size: { sm: 'h-6 px-2.5', md: 'h-8 px-3' },
    },
    defaultVariants: { size: 'sm' },
  },
)

function StatusPill({
  status,
  size = 'sm',
  className,
}: {
  status: PillStatus
  size?: 'sm' | 'md'
  className?: string
}) {
  const { label, icon: Icon, classes } = STATUS_PILL[status]
  return (
    <span
      data-slot="status-pill"
      data-status={status}
      className={cn(pillVariants({ size }), classes, className)}
    >
      <Icon aria-hidden="true" strokeWidth={1.75} className="size-3.5 shrink-0" />
      {label}
    </span>
  )
}

export { STATUS_PILL, StatusPill }
export type { PillStatus }
