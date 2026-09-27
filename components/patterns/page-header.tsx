import type * as React from 'react'
import { focusFallbackProps } from './focus-fallback'

/**
 * The page title (one per page), an optional description and actions (DESIGN_SYSTEM §9). The `h1`
 * is the page-wide focus fallback (focusable by script only): where focus goes when an action
 * control disappears with it and no Section of the page is marked (re-review M2).
 */
function PageHeader({
  title,
  description,
  actions,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <header
      data-slot="page-header"
      className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"
    >
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-2xl font-semibold md:text-3xl" {...focusFallbackProps('page')}>
          {title}
        </h1>
        {description && <p className="text-base text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

export { PageHeader }
