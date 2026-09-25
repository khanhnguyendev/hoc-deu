'use client'

import { ChevronDown } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { vi } from '@/lib/i18n/vi'
import { cn } from '@/lib/utils'
import { CONTENT_FLOW } from './typography'

/**
 * `<Reveal label?>` — content hidden until the learner opens it (a hint, an aside): a button with
 * `aria-expanded` / `aria-controls`, "Xem" / "Ẩn" or its `label`.
 */
function Reveal({ label, children }: { label?: string; children?: ReactNode }) {
  const [open, setOpen] = useState(false)
  const contentId = useId()
  return (
    <div data-slot="reveal" className="space-y-3">
      <Button
        variant="outline"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((value) => !value)}
      >
        <ChevronDown
          aria-hidden="true"
          strokeWidth={1.75}
          className={cn(
            'transition-transform duration-(--duration-fast) ease-standard',
            open && 'rotate-180',
          )}
        />
        {label ?? (open ? vi.content.reveal.hide : vi.content.reveal.show)}
      </Button>
      <div id={contentId} hidden={!open} className={CONTENT_FLOW}>
        {children}
      </div>
    </div>
  )
}

export { Reveal }
