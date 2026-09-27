'use client'

import { cva } from 'class-variance-authority'
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { toast } from '@/components/ui/toaster'
import { vi } from '@/lib/i18n/vi'
import { cn } from '@/lib/utils'
import { focusFallbackElement, focusLost } from './focus-fallback'
import { isNavigationError } from './navigation-error'

/** What a server action answers a control: whether it worked, and what to say. */
export type ActionAnswer = { readonly ok: boolean; readonly message: string }

/** The answer as `run`'s caller sees it: `thrown` when the request itself failed. */
export type SettledAnswer = ActionAnswer & { readonly thrown: boolean }

type Shown = ActionAnswer & {
  /** Counts the answers, so the status region re-announces a repeated message. */
  readonly seq: number
}

export type ActionFeedback = {
  /** The action and the re-render it causes are running: show the control busy. */
  readonly pending: boolean
  /** The last answer while it is the control's to show (null while pending, or once toasted). */
  readonly answer: Shown | null
  /**
   * Sends `send()` unless a send is running. `onAnswer` sees the answer first and may return
   * `'toast'` to deliver it as a toast now — for a control that closes itself on success (the
   * check-in sheet). A rejection is caught: it answers "Không lưu được thay đổi. Bạn thử lại
   * nhé." and never reaches the route's error boundary — except Next's own navigation (a guard's
   * `redirect()`, a `notFound()`), which says nothing: the router is already leaving (M1).
   */
  readonly run: (
    send: () => Promise<ActionAnswer>,
    onAnswer?: (answer: SettledAnswer) => 'toast' | void,
  ) => void
  /** Forgets the shown answer (a reopened sheet starts clean). Stable across renders. */
  readonly reset: () => void
}

/**
 * One way for a control to send a server action and say what happened (UI I-3): "Học tiếp hôm
 * nay", one-tap check-in and the check-in sheet, "Học thêm", "Bắt đầu lại".
 *
 * - **Pending:** `pending` covers the action and the page re-render it causes; a second press
 *   meanwhile sends nothing.
 * - **Failed request:** a rejection (offline, a 5xx) becomes the save-failed answer beside the
 *   control — an async transition that throws would otherwise replace the page with its error
 *   boundary. Next's own navigation (a guard `redirect()`, `notFound()`) is not a failure: the
 *   router is already leaving, so the control says nothing (M1, `isNavigationError`).
 * - **Where the answer goes — never two places:** the actions revalidate the page, and the
 *   re-render can remove the control that asked (a check-in collapses its button, a stale plan
 *   is swapped, the paused view ends). The answer shows in the control's own status region
 *   (`ActionStatus`) once the re-render is over; if that re-render removed the control first, the
 *   answer is a toast instead. An answer already shown is never toasted later.
 * - **Focus:** when a control that has had an answer disappears with focus on `<body>` (the
 *   button it removed held it), focus moves to `focusTarget()` (e.g. the block's new "Sửa"),
 *   else to the page's focus fallback — the heading a `Section` marks with `focusFallback`
 *   (DESIGN_SYSTEM §10). Focus that is still somewhere is never moved.
 */
export function useActionFeedback(
  options: { focusTarget?: () => HTMLElement | null } = {},
): ActionFeedback {
  const [pending, startTransition] = useTransition()
  const [shown, setShown] = useState<Shown | null>(null)
  const sending = useRef(false)
  const seq = useRef(0)
  // The last answer until the status region has shown it: a toast if the control goes first.
  const undelivered = useRef<ActionAnswer | null>(null)
  // The control has had an answer: its unmount may be that answer's re-render.
  const answered = useRef(false)
  const focusTarget = useRef(options.focusTarget)

  useEffect(() => {
    focusTarget.current = options.focusTarget
  })

  // Committed with the re-render over and the control still here: the region shows the answer.
  useEffect(() => {
    if (!pending && shown !== null) undelivered.current = null
  }, [pending, shown])

  // Runs after the commit that removed the control, so the page's new elements exist.
  useEffect(
    () => () => {
      const answer = undelivered.current
      undelivered.current = null
      if (answer !== null) toast(answer.message)
      if (answered.current && focusLost()) {
        ;(focusTarget.current?.() ?? focusFallbackElement())?.focus()
      }
    },
    [],
  )

  const run: ActionFeedback['run'] = (send, onAnswer) => {
    if (sending.current) return
    sending.current = true
    setShown(null)
    startTransition(async () => {
      let answer: SettledAnswer
      try {
        const result = await send()
        answer = { ok: result.ok, message: result.message, thrown: false }
      } catch (error) {
        // The router is navigating (a guard redirect): nothing to say, nothing to toast (M1).
        if (isNavigationError(error)) return
        answer = { ok: false, message: vi.errors.saveFailed, thrown: true }
      } finally {
        sending.current = false
      }
      answered.current = true
      if (onAnswer?.(answer) === 'toast') {
        toast(answer.message)
        return
      }
      seq.current += 1
      undelivered.current = { ok: answer.ok, message: answer.message }
      setShown({ ok: answer.ok, message: answer.message, seq: seq.current })
    })
  }

  const reset = useCallback(() => {
    undelivered.current = null
    setShown(null)
  }, [])

  return { pending, answer: pending ? null : shown, run, reset }
}

const actionStatusVariants = cva('text-sm', {
  variants: {
    /** `below`: under a control in a gapless column, spaced only while it says something. */
    spacing: { below: '', none: '' },
    shown: { true: '', false: '' },
  },
  compoundVariants: [{ spacing: 'below', shown: true, className: 'mt-2' }],
  defaultVariants: { spacing: 'below', shown: false },
})

/**
 * The control's polite status region (DESIGN_SYSTEM §10): the answer of `useActionFeedback` —
 * empty while pending — keyed by the answer, so the same message twice is announced twice.
 * `spacing="none"` inside a container that already spaces its children.
 */
function ActionStatus({
  feedback,
  spacing = 'below',
}: {
  feedback: ActionFeedback
  spacing?: 'below' | 'none'
}) {
  const { answer } = feedback
  return (
    <p
      data-slot="action-status"
      role="status"
      aria-live="polite"
      className={cn(actionStatusVariants({ spacing, shown: answer !== null }))}
    >
      {answer !== null && <span key={answer.seq}>{answer.message}</span>}
    </p>
  )
}

export { ActionStatus }
