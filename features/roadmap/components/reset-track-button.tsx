'use client'

import { RotateCcw } from 'lucide-react'
import { ConfirmActionButton } from '@/components/patterns/confirm-action-button'
import { vi } from '@/lib/i18n/vi'

const copy = vi.extra.reset

/** `resetTrack` (features/settings), passed unbound from the page. */
export type ResetTrackAction = (input: {
  requestId: string
  trackId: string
}) => Promise<{ readonly ok: boolean; readonly message: string }>

/**
 * "Bắt đầu lại" on the track page (§5.9; Part B-M2 decision 18; task 5.4), for an active or paused
 * enrollment: a ConfirmActionButton that asks first — a destructive dialog, "Xoá tiến độ của lộ
 * trình này?" / "Lịch sử học và chuỗi ngày vẫn được giữ." — then sends `{ requestId, trackId }`
 * (the render's request id: a double tap resets once, decision 16). The button stays on the
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
  return (
    <ConfirmActionButton
      icon={RotateCcw}
      label={copy.action}
      dialog={{ title: copy.title, description: copy.description, confirm: copy.confirm }}
      tone="destructive"
      align="start"
      send={() => action({ requestId, trackId })}
    />
  )
}

export { ResetTrackButton }
