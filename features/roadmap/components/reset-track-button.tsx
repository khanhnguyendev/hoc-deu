'use client'

import { RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { ActionStatus, useActionFeedback } from '@/components/patterns/action-feedback'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { Button } from '@/components/ui/button'
import { vi } from '@/lib/i18n/vi'

const copy = vi.extra.reset

/** `resetTrack` (features/settings), passed unbound from the page. */
export type ResetTrackAction = (input: {
  requestId: string
  trackId: string
}) => Promise<{ readonly ok: boolean; readonly message: string }>

/**
 * "Bắt đầu lại" on the track page (§5.9; Part B-M2 decision 18; task 5.4), for an active or paused
 * enrollment: an outline button that asks first — a destructive ConfirmDialog, "Xoá tiến độ của
 * lộ trình này?" / "Lịch sử học và chuỗi ngày vẫn được giữ." — then sends `{ requestId, trackId }`
 * (the render's request id: a double tap resets once, decision 16) through `useActionFeedback`
 * (UI I-3). The dialog stays open and busy while it runs, then closes (focus back on the button);
 * a failed request is said beside the button, never the error boundary. The button stays on the
 * re-rendered track page, so the answer is in its own polite region — not also a toast (m-4).
 */
function ResetTrackButton({
  action,
  requestId,
  trackId,
}: {
  action: ResetTrackAction
  requestId: string
  trackId: string
}) {
  const [confirming, setConfirming] = useState(false)
  const feedback = useActionFeedback()

  const confirm = () => {
    feedback.run(
      () => action({ requestId, trackId }),
      () => setConfirming(false),
    )
  }

  return (
    <div data-slot="reset-track-button" className="flex flex-col items-start">
      <Button variant="outline" onClick={() => setConfirming(true)}>
        <RotateCcw aria-hidden="true" strokeWidth={1.75} />
        {copy.action}
      </Button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={copy.title}
        description={copy.description}
        confirmLabel={copy.confirm}
        tone="destructive"
        pending={feedback.pending && confirming}
        onConfirm={confirm}
      />
      <ActionStatus feedback={feedback} />
    </div>
  )
}

export { ResetTrackButton }
