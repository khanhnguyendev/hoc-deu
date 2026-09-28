'use client'

import { Undo2 } from 'lucide-react'
import { ConfirmActionButton } from '@/components/patterns/confirm-action-button'
import { fill } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'

const copy = vi.overrides.revoke

/** `revokeAiOverride` (features/settings/actions), passed unbound from the page. */
export type RevokeAiOverrideAction = (input: {
  requestId: string
  trackId: string
  key: string
}) => Promise<{ readonly ok: boolean; readonly message: string }>

/**
 * "Thu hồi" on one AI roadmap override (§5.12 "Learner control", §5.9; task 6.6c): a
 * ConfirmActionButton named "Thu hồi: {the override's line} ({track})" — unique per row, since two
 * tracks can have the same line — that asks first ("Thu hồi điều chỉnh này?" / "Thay đổi có hiệu
 * lực từ kế hoạch ngày mai."), then sends `{ requestId, trackId, key }` (the render's request id: a
 * double tap revokes once). The re-rendered list drops the row, so the answer then comes as a
 * toast.
 */
function RevokeOverrideButton({
  action,
  requestId,
  trackId,
  overrideKey,
  title,
  trackTitle,
}: {
  action: RevokeAiOverrideAction
  requestId: string
  trackId: string
  overrideKey: string
  /** The override's line: the button's accessible name after its visible text. */
  title: string
  /** The track's title, after the line in the accessible name. */
  trackTitle: string
}) {
  return (
    <ConfirmActionButton
      icon={Undo2}
      label={copy.action}
      ariaLabel={fill(copy.actionLabel, { title, track: trackTitle })}
      dialog={{ title: copy.title, description: copy.description, confirm: copy.confirm }}
      send={() => action({ requestId, trackId, key: overrideKey })}
    />
  )
}

export { RevokeOverrideButton }
