import { Clock, TriangleAlert } from 'lucide-react'
import { useId } from 'react'
import type * as React from 'react'
import { StatusPill } from '@/components/patterns/status-pill'
import { Badge } from '@/components/ui/badge'
import type { BlockState } from '@/lib/domain/state'
import { formatMinutes } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'
import { EMPTY_BLOCK_SLOTS, type BlockSlots } from '../slots'
import type { BlockView } from '../view-model'
import { BlockItemList } from './block-item-list'
import { ShadowingSentences } from './shadowing-sentences'

const copy = vi.today.block

/** The plain checked-in status row: the status pill (icon + label), minutes, "tự động". Task
 *  5.2b replaces it with CheckInStatus and its "Sửa" link. */
function CheckedIn({ checkIn }: { checkIn: BlockState }) {
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
      <span>{copy.checkedIn}</span> <StatusPill status={`block-${checkIn.status}`} />{' '}
      <span>{formatMinutes(checkIn.minutes)}</span>
      {checkIn.auto && (
        <>
          {' '}
          <span aria-hidden="true">·</span> <span>{copy.auto}</span>
        </>
      )}
    </p>
  )
}

type PlanBlockCardProps = {
  view: BlockView
  /** The block's registry rows and shadowing sentences (`todaySlots`, built by the page). */
  slots?: BlockSlots
  /** Task 5.2b: the one-tap check-in. Empty until then. */
  actions?: React.ReactNode
}

/**
 * A plan block (DESIGN_SYSTEM §9): the 4 px track stripe, the kind and the track chip, the
 * estimated minutes, "Dài hơn thời gian dự kiến" when over budget, the item rows (or a shadowing
 * block's sentences), the checked-in status row, and the `actions` slot. A card-only block lists
 * its rows until task 5.4 renders the card session there (decision 19).
 */
function PlanBlockCard({ view, slots = EMPTY_BLOCK_SLOTS, actions }: PlanBlockCardProps) {
  const titleId = useId()
  const trackId = useId()
  const isShadowing = view.block.shadowing !== undefined
  return (
    <article
      data-slot="plan-block-card"
      data-accent={view.accent}
      aria-labelledby={`${titleId} ${trackId}`}
      className="flex overflow-hidden rounded-lg border border-border bg-surface"
    >
      <span aria-hidden="true" className="w-1 shrink-0 bg-track" />
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4 md:p-5">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 id={titleId} className="text-lg font-semibold">
              {view.kindLabel}
            </h3>{' '}
            <Badge id={trackId} tone="track">
              {view.trackTitle}
            </Badge>
          </div>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0" />
            {formatMinutes(view.minutes)}
          </p>
        </header>
        {view.overBudget && (
          <Badge tone="warning">
            <TriangleAlert aria-hidden="true" strokeWidth={1.75} />
            {copy.overBudget}
          </Badge>
        )}
        {isShadowing ? (
          <ShadowingSentences sentences={slots.sentences} />
        ) : (
          <BlockItemList items={slots.items} />
        )}
        {view.checkIn !== null && <CheckedIn checkIn={view.checkIn} />}
        {actions}
      </div>
    </article>
  )
}

export { PlanBlockCard }
export type { PlanBlockCardProps }
