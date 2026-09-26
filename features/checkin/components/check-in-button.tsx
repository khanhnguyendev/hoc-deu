'use client'

import { Check } from 'lucide-react'
import { useRef, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toaster'
import { vi } from '@/lib/i18n/vi'
import { cn } from '@/lib/utils'
import type { CheckInResult } from '../actions'
import type { CheckInInput } from '../schema'

/** `checkInBlock`, passed unbound from the page: the client builds its input. */
export type CheckInAction = (input: CheckInInput) => Promise<CheckInResult>

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
 * `checkInMinutes` (decision 34 of M4) — with the page's request ID and the block's plan and ID.
 * Pending while the action runs; a second tap meanwhile sends nothing (RF-2 — and the event ID
 * would repeat anyway). The answer goes to a polite live region beside the button; the action
 * revalidates `/today`, whose re-render collapses the button into CheckInStatus, so a success is
 * also a toast, which outlives it. A refusal or a failed request stays beside the button, which
 * can be tapped again (a toast is never the only feedback for a failure).
 */
function CheckInButton({ action, requestId, planId, blockId, blockLabel }: CheckInButtonProps) {
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState('')
  const sending = useRef(false)

  const onClick = () => {
    if (sending.current) return
    sending.current = true
    startTransition(async () => {
      try {
        const result = await action({ requestId, planId, blockId, status: 'done' })
        setMessage(result.message)
        if (result.ok) toast(result.message)
      } catch {
        setMessage(vi.errors.saveFailed)
      } finally {
        sending.current = false
      }
    })
  }

  return (
    <div data-slot="check-in-button" className="flex flex-col">
      {/* Named "Check-in: {kind} · {track}", starting with its visible label (WCAG 2.5.3); an
          sr-only suffix would read "Check-in : …" in Chromium. */}
      <Button
        size="lg"
        className="w-full"
        onClick={onClick}
        loading={pending}
        aria-label={`${vi.checkIn.oneTap}: ${blockLabel}`}
      >
        <Check aria-hidden="true" strokeWidth={1.75} />
        {vi.checkIn.oneTap}
      </Button>
      <p role="status" aria-live="polite" className={cn('text-sm', message !== '' && 'mt-2')}>
        {message}
      </p>
    </div>
  )
}

export { CheckInButton }
export type { CheckInButtonProps }
