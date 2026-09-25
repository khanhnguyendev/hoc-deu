import { CircleCheck, Info, type LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { Verification } from '@/lib/content/verification'
import { vi } from '@/lib/i18n/vi'

const copy = vi.items.verification

const VERIFICATION: Record<
  Verification,
  { label: string; hint: string; icon: LucideIcon; tone: 'success' | 'neutral' }
> = {
  tested: { label: copy.tested, hint: copy.testedHint, icon: CircleCheck, tone: 'success' },
  'compile-only': {
    label: copy.compileOnly,
    hint: copy.compileOnlyHint,
    icon: Info,
    tone: 'neutral',
  },
}

/**
 * How a problem's solutions are verified (§3.7, decision 21): "Đã kiểm thử" (`CircleCheck`) or
 * "Chỉ biên dịch" (`Info`). `full` (pages) adds the one-line explanation; `icon` (rows) is the
 * icon with a visually hidden label.
 */
function VerificationBadge({
  verification,
  variant = 'full',
}: {
  verification: Verification
  variant?: 'full' | 'icon'
}) {
  const { label, hint, icon: Icon, tone } = VERIFICATION[verification]
  if (variant === 'icon') {
    return (
      <span data-slot="verification-badge" data-verification={verification} className="inline-flex">
        <Icon aria-hidden="true" strokeWidth={1.75} className="size-4" />
        <span className="sr-only">{label}</span>
      </span>
    )
  }
  return (
    <span
      data-slot="verification-badge"
      data-verification={verification}
      className="inline-flex flex-wrap items-center gap-x-2 gap-y-1"
    >
      <Badge tone={tone}>
        <Icon aria-hidden="true" strokeWidth={1.75} />
        {label}
      </Badge>
      <span className="text-sm text-muted-foreground">{hint}</span>
    </span>
  )
}

export { VerificationBadge }
