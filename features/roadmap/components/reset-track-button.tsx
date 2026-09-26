'use client'

import { RotateCcw } from 'lucide-react'
import { useState, useTransition } from 'react'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toaster'
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
 * (the render's request id: a double tap resets once, decision 16). The dialog stays open and busy
 * while it runs, then closes (focus back on the button). The answer goes to a polite live region
 * beside the button; a success is also a toast, which outlives the page's re-render.
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
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState('')

  const confirm = () => {
    if (pending) return
    startTransition(async () => {
      const result = await action({ requestId, trackId })
      setMessage(result.message)
      setConfirming(false)
      if (result.ok) toast(result.message)
    })
  }

  return (
    <div data-slot="reset-track-button" className="flex flex-col items-start gap-2">
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
        pending={pending}
        onConfirm={confirm}
      />
      <p role="status" aria-live="polite" className="text-sm">
        {message}
      </p>
    </div>
  )
}

export { ResetTrackButton }
