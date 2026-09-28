'use client'

import { EyeOff } from 'lucide-react'
import { useState } from 'react'
import { ActionStatus, useActionFeedback } from '@/components/patterns/action-feedback'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { Button } from '@/components/ui/button'
import { withTitle } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'

const copy = vi.customItems.hide

/** `hideCustomItem` (features/roadmap/actions), passed unbound from the page. */
export type HideCustomItemAction = (input: {
  requestId: string
  itemId: string
}) => Promise<{ readonly ok: boolean; readonly message: string }>

/**
 * "Ẩn" on a custom item of the "Mục riêng" tab (§5.12; task 6.6a): an outline button named "Ẩn
 * {title}" that asks first — a ConfirmDialog "Ẩn mục này?" / "Mục này sẽ không xuất hiện trong kế
 * hoạch từ ngày mai." — then sends `{ requestId, itemId }` (the render's request id: a double tap
 * hides once) through `useActionFeedback`. The dialog stays open and busy while it runs; the
 * re-rendered tab moves the item to the hidden ones, so the answer then comes as a toast.
 */
function HideCustomItemButton({
  action,
  requestId,
  itemId,
  title,
}: {
  action: HideCustomItemAction
  requestId: string
  itemId: string
  /** The item's title: the button's accessible name after its visible text. */
  title: string
}) {
  const [confirming, setConfirming] = useState(false)
  const feedback = useActionFeedback()

  const confirm = () => {
    feedback.run(
      () => action({ requestId, itemId }),
      () => setConfirming(false),
    )
  }

  return (
    <div data-slot="hide-custom-item-button" className="flex shrink-0 flex-col items-end">
      <Button
        variant="outline"
        aria-label={withTitle(copy.actionLabel, title)}
        onClick={() => setConfirming(true)}
      >
        <EyeOff aria-hidden="true" strokeWidth={1.75} />
        {copy.action}
      </Button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={copy.title}
        description={copy.description}
        confirmLabel={copy.confirm}
        pending={feedback.pending && confirming}
        onConfirm={confirm}
      />
      <ActionStatus feedback={feedback} />
    </div>
  )
}

export { HideCustomItemButton }
