'use client'

import { Undo2 } from 'lucide-react'
import { useState } from 'react'
import { ActionStatus, useActionFeedback } from '@/components/patterns/action-feedback'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { Button } from '@/components/ui/button'
import { withTitle } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'

const copy = vi.overrides.revoke

/** `revokeAiOverride` (features/settings/actions), passed unbound from the page. */
export type RevokeAiOverrideAction = (input: {
  requestId: string
  trackId: string
  key: string
}) => Promise<{ readonly ok: boolean; readonly message: string }>

/**
 * "Thu hồi" on one AI roadmap override (§5.12 "Learner control", §5.9; task 6.6c): an outline
 * button named "Thu hồi: {the override's line}" that asks first — a ConfirmDialog "Thu hồi điều
 * chỉnh này?" / "Thay đổi có hiệu lực từ kế hoạch ngày mai." — then sends `{ requestId, trackId,
 * key }` (the render's request id: a double tap revokes once) through `useActionFeedback`. The
 * dialog stays open and busy while it runs; the re-rendered list drops the row, so the answer then
 * comes as a toast.
 */
function RevokeOverrideButton({
  action,
  requestId,
  trackId,
  overrideKey,
  title,
}: {
  action: RevokeAiOverrideAction
  requestId: string
  trackId: string
  overrideKey: string
  /** The override's line: the button's accessible name after its visible text. */
  title: string
}) {
  const [confirming, setConfirming] = useState(false)
  const feedback = useActionFeedback()

  const confirm = () => {
    feedback.run(
      () => action({ requestId, trackId, key: overrideKey }),
      () => setConfirming(false),
    )
  }

  return (
    <div data-slot="revoke-override-button" className="flex shrink-0 flex-col items-end">
      <Button
        variant="outline"
        aria-label={withTitle(copy.actionLabel, title)}
        onClick={() => setConfirming(true)}
      >
        <Undo2 aria-hidden="true" strokeWidth={1.75} />
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

export { RevokeOverrideButton }
