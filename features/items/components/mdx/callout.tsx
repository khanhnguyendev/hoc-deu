import { cva } from 'class-variance-authority'
import { Info, Lightbulb, TriangleAlert, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { vi } from '@/lib/i18n/vi'
import { own } from './copy'

type Tone = 'info' | 'tip' | 'warning'

const callout = cva('flex gap-3 rounded-lg p-4', {
  variants: {
    tone: {
      info: 'bg-primary-soft text-primary-soft-foreground',
      tip: 'bg-success-soft text-success-soft-foreground',
      warning: 'bg-warning-soft text-warning-soft-foreground',
    },
  },
})

const ICONS: Readonly<Record<Tone, LucideIcon>> = {
  info: Info,
  tip: Lightbulb,
  warning: TriangleAlert,
}

/**
 * `<Callout tone title?>` — an aside in a lesson or note: icon + visible label ("Lưu ý" / "Mẹo" /
 * "Cẩn thận", or `title`) on the tone's soft surface, so the tone is never colour alone.
 */
function Callout({ tone, title, children }: { tone: Tone; title?: string; children?: ReactNode }) {
  const known: Tone = own(ICONS, tone) === undefined ? 'info' : tone
  const Icon = ICONS[known]
  return (
    <div role="note" data-slot="callout" data-tone={known} className={callout({ tone: known })}>
      <Icon aria-hidden="true" strokeWidth={1.75} className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0 flex-1 space-y-2">
        <p className="font-semibold">{title ?? vi.content.callout[known]}</p>
        {children}
      </div>
    </div>
  )
}

export { Callout }
