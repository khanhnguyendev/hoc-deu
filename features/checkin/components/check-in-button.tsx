'use client'

import { Check } from 'lucide-react'
import { ActionStatus, useActionFeedback } from '@/components/patterns/action-feedback'
import { Button } from '@/components/ui/button'
import { vi } from '@/lib/i18n/vi'
import type { CheckInResult } from '../actions'
import type { CheckInInput } from '../schema'

/** `checkInBlock`, passed unbound from the page: the client builds its input. */
export type CheckInAction = (input: CheckInInput) => Promise<CheckInResult>

/**
 * The block's check-in control on the page, if shown: its "Sửa" link (CheckInStatus marks it
 * `data-check-in-edit="<blockId>"`), else its one-tap button (`data-check-in-button`).
 */
export function checkInControlOf(blockId: string): HTMLElement | null {
  for (const element of document.querySelectorAll<HTMLElement>('[data-check-in-edit]')) {
    if (element.dataset.checkInEdit === blockId) return element
  }
  for (const element of document.querySelectorAll<HTMLElement>('[data-check-in-button]')) {
    if (element.dataset.checkInButton === blockId) return element
  }
  return null
}

type CheckInButtonProps = {
  action: CheckInAction
  /** The page's per-render request ID (decision 16): the same tap twice is one event. */
  requestId: string
  planId: string
  blockId: string
  /** "{kind} · {track}": completes the button's accessible name (several cards, one page). */
  blockLabel: string
}

/**
 * The one-tap check-in (§5.5, DESIGN_SYSTEM §9): the full-width 48 px primary "Check-in" at the
 * bottom of a PlanBlockCard. It sends `done` without minutes — the server pre-fills the block's
 * `checkInMinutes` (decision 34 of M4) — with the page's request ID and the block's plan and ID,
 * through `useActionFeedback` (UI I-3): pending while the action and the re-render run (a second
 * tap sends nothing, RF-2); a failed request says so beside the button. The action revalidates
 * `/today`: a success collapses the button into CheckInStatus and a stale answer swaps the plan,
 * so the answer is a toast when the button is gone and its own polite region while it stays —
 * never both — and focus moves to the block's "Sửa" (or one-tap) on the new page, else to the
 * plan's heading (DESIGN_SYSTEM §10).
 */
function CheckInButton({ action, requestId, planId, blockId, blockLabel }: CheckInButtonProps) {
  const feedback = useActionFeedback({ focusTarget: () => checkInControlOf(blockId) })

  const onClick = () => {
    feedback.run(() => action({ requestId, planId, blockId, status: 'done' }))
  }

  return (
    <div data-slot="check-in-button" className="flex flex-col">
      {/* Named "Check-in: {kind} · {track}", starting with its visible label (WCAG 2.5.3); an
          sr-only suffix would read "Check-in : …" in Chromium. */}
      <Button
        size="lg"
        className="w-full"
        onClick={onClick}
        loading={feedback.pending}
        aria-label={`${vi.checkIn.oneTap}: ${blockLabel}`}
        data-check-in-button={blockId}
      >
        <Check aria-hidden="true" strokeWidth={1.75} />
        {vi.checkIn.oneTap}
      </Button>
      <ActionStatus feedback={feedback} />
    </div>
  )
}

export { CheckInButton }
export type { CheckInButtonProps }
