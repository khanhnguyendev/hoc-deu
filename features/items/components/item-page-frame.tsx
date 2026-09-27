import { CalendarCheck } from 'lucide-react'
import type * as React from 'react'
import { PageHeader } from '@/components/patterns/page-header'
import { StatusPill } from '@/components/patterns/status-pill'
import { Badge } from '@/components/ui/badge'
import type { ItemStatus } from '@/lib/content/schemas/common'
import type { OutcomeBinding } from '../outcome'
import { pillStatusOf } from '../status'
import { ItemStatusNotice } from './item-status-badge'
import { ItemActions } from './outcome/item-actions'

/**
 * The frame every item Page shares: the draft / retired notice at the top, the title as the page
 * `h1` (PageHeader; omitted when the body renders it, like a flashcard's front), a line of facts,
 * then the body. With the page's `outcome` binding (task 5.2c) the facts end with the learner's
 * status pill ("Chưa học" before any result) and, when the item is in the current plan, its label
 * ("Trong kế hoạch hôm nay"); ItemActions ("Bỏ qua mục này", "Ôn lại") follow the body. Without a
 * binding (a draft an admin previews, a retired item) the page is read-only: none of them.
 */
function ItemPageFrame({
  status,
  title,
  description,
  actions,
  meta,
  outcome,
  children,
}: {
  status: ItemStatus
  title?: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  /** Short facts (a badge, "#1", a topic), in order. */
  meta?: React.ReactNode[]
  outcome?: OutcomeBinding
  children?: React.ReactNode
}) {
  const learner: React.ReactNode[] =
    outcome === undefined
      ? []
      : [
          <StatusPill key="state" status={pillStatusOf(outcome.state)} />,
          outcome.plan === null ? null : (
            <Badge key="plan" tone="primary">
              <CalendarCheck aria-hidden="true" strokeWidth={1.75} />
              {outcome.plan.label}
            </Badge>
          ),
        ]
  const facts = [...(meta ?? []), ...learner].filter(
    (fact) => fact !== null && fact !== undefined && fact !== '',
  )
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
      {outcome !== undefined && <ItemActions binding={outcome} />}
    </div>
  )
}

export { ItemPageFrame }
