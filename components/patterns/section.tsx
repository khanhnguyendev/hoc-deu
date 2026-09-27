import { useId } from 'react'
import type * as React from 'react'
import { FOCUS_FALLBACK_ATTRIBUTE } from './focus-fallback'

/**
 * A titled page region; screen readers list it by its heading. `focusFallback` makes the heading
 * the page's focus fallback (`tabIndex={-1}`, focusable by script only): where focus goes when an
 * action control disappears with it (`useActionFeedback`, DESIGN_SYSTEM §10). One per page.
 */
function Section({
  title,
  description,
  actions,
  focusFallback = false,
  children,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  focusFallback?: boolean
  children: React.ReactNode
}) {
  const headingId = useId()
  const fallback = focusFallback ? { tabIndex: -1, [FOCUS_FALLBACK_ATTRIBUTE]: '' } : {}
  return (
    <section data-slot="section" aria-labelledby={headingId} className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id={headingId} className="text-xl font-semibold" {...fallback}>
            {title}
          </h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  )
}

export { Section }
