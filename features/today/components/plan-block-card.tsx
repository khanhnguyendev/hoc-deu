import { Clock, TriangleAlert } from 'lucide-react'
import { useId } from 'react'
import type * as React from 'react'
import { Badge } from '@/components/ui/badge'
import { CheckInStatus } from '@/features/checkin'
import { fill, formatMinutes } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'
import { EMPTY_BLOCK_SLOTS, type BlockSlots } from '../slots'
import type { BlockView } from '../view-model'
import { BlockItemList } from './block-item-list'
import { ShadowingSentences } from './shadowing-sentences'

const copy = vi.today.block

/** "{kind} · {track}": names the block's check-in controls for screen readers. */
function blockLabel(view: BlockView): string {
  return fill(vi.checkIn.blockLabel, { kind: view.kindLabel, track: view.trackTitle })
}

type PlanBlockCardProps = {
  view: BlockView
  /** The block's registry rows and shadowing sentences (`todaySlots`, built by the page). */
  slots?: BlockSlots
  /** The one-tap check-in (CheckInButton, task 5.2b) while the block has no check-in. */
  actions?: React.ReactNode
  /** A card-only block's card session (CardBlock, task 5.4 — decision 19), shown instead of its
   *  rows. */
  cards?: React.ReactNode
  /** The paused view (§5.2): a skipped block says how to correct it (M-6 a). */
  paused?: boolean
}

/**
 * A plan block (DESIGN_SYSTEM §9): the 4 px track stripe, the kind and the track chip, the
 * estimated minutes, "Dài hơn thời gian dự kiến" when over budget, the item rows (or a shadowing
 * block's sentences), then the `actions` slot — the one-tap check-in — which a check-in collapses
 * into CheckInStatus (the status pill, minutes, "tự động", "Sửa"; in the paused view a skipped
 * block's M-6 lines). A card-only block shows its `cards` slot — CardBlock, the inline card
 * session (task 5.4, decision 19) — instead of its rows.
 */
function PlanBlockCard({
  view,
  slots = EMPTY_BLOCK_SLOTS,
  actions,
  cards,
  paused = false,
}: PlanBlockCardProps) {
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
          (cards ?? <BlockItemList items={slots.items} />)
        )}
        {view.checkIn !== null && (
          <CheckInStatus
            checkIn={view.checkIn}
            editHref={view.editHref}
            blockId={view.block.id}
            blockLabel={blockLabel(view)}
            paused={paused}
          />
        )}
        {actions}
      </div>
    </article>
  )
}

export { blockLabel, PlanBlockCard }
export type { PlanBlockCardProps }
