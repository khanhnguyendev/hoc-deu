import type * as React from 'react'
import { PageHeader } from '@/components/patterns/page-header'
import type { ItemStatus } from '@/lib/content/schemas/common'
import { ItemStatusNotice } from './item-status-badge'

/**
 * The frame every item Page shares: the draft / retired notice at the top, the title as the page
 * `h1` (PageHeader; omitted when the body renders it, like a flashcard's front), a line of facts,
 * then the body.
 */
function ItemPageFrame({
  status,
  title,
  description,
  actions,
  meta,
  children,
}: {
  status: ItemStatus
  title?: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  /** Short facts (a badge, "#1", a topic), in order. */
  meta?: React.ReactNode[]
  children?: React.ReactNode
}) {
  const facts = (meta ?? []).filter((fact) => fact !== null && fact !== undefined && fact !== '')
  return (
    <div data-slot="item-page" className="flex min-w-0 flex-col gap-6">
      <ItemStatusNotice status={status} />
      {title !== undefined && (
        <PageHeader title={title} description={description} actions={actions} />
      )}
      {facts.length > 0 && (
        <div
          data-slot="item-meta"
          className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground"
        >
          {facts.map((fact, index) => (
            // The facts are a fixed, ordered list: the index is their identity.
            <span key={index} className="inline-flex items-center">
              {fact}
            </span>
          ))}
        </div>
      )}
      {children}
    </div>
  )
}

export { ItemPageFrame }
