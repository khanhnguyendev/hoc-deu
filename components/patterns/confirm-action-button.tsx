'use client'

import { cva } from 'class-variance-authority'
import type { LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ActionStatus, useActionFeedback, type ActionAnswer } from './action-feedback'
import { ConfirmDialog } from './confirm-dialog'

const confirmActionButtonVariants = cva('flex flex-col', {
  variants: {
    /** `start`: at the start of its column (the track page); `end`: at the end of a list row. */
    align: { start: 'items-start', end: 'shrink-0 items-end' },
  },
  defaultVariants: { align: 'end' },
})

/**
 * An outline button that asks first, then sends one server action (DESIGN_SYSTEM §9 destructive
 * actions): the button opens a ConfirmDialog; confirming runs `send` through `useActionFeedback`
 * (UI I-3) — the dialog stays open and busy while it runs, then closes (focus back on the button)
 * — and the answer is said in the button's own polite `ActionStatus` region, or as a toast when
 * the page's re-render removed the button first. A failed request is said beside the button,
 * never the error boundary. "Bắt đầu lại", "Ẩn" (custom items), "Thu hồi" (AI overrides).
 */
function ConfirmActionButton({
  icon: Icon,
  label,
  ariaLabel,
  dialog,
  tone = 'default',
  align = 'end',
  send,
}: {
  icon: LucideIcon
  /** The button's visible text. */
  label: string
  /** The accessible name when several buttons share `label`: it starts with it (label in name). */
  ariaLabel?: string
  dialog: { title: string; description: string; confirm: string }
  /** `destructive`: the dialog's confirm button is the destructive one. */
  tone?: 'default' | 'destructive'
  align?: 'start' | 'end'
  send: () => Promise<ActionAnswer>
}) {
  const [confirming, setConfirming] = useState(false)
  const feedback = useActionFeedback()

  const confirm = () => feedback.run(send, () => setConfirming(false))

  return (
    <div data-slot="confirm-action-button" className={confirmActionButtonVariants({ align })}>
      <Button variant="outline" aria-label={ariaLabel} onClick={() => setConfirming(true)}>
        <Icon aria-hidden="true" strokeWidth={1.75} />
        {label}
      </Button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={dialog.title}
        description={dialog.description}
        confirmLabel={dialog.confirm}
        tone={tone}
        pending={feedback.pending && confirming}
        onConfirm={confirm}
      />
      <ActionStatus feedback={feedback} />
    </div>
  )
}

export { ConfirmActionButton }
