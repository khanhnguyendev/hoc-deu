'use client'

import { EyeOff } from 'lucide-react'
import { ConfirmActionButton } from '@/components/patterns/confirm-action-button'
import { withTitle } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'

const copy = vi.customItems.hide

/** `hideCustomItem` (features/roadmap/actions), passed unbound from the page. */
export type HideCustomItemAction = (input: {
  requestId: string
  itemId: string
}) => Promise<{ readonly ok: boolean; readonly message: string }>

/**
 * "Ẩn" on a custom item of the "Mục riêng" tab (§5.12; task 6.6a): a ConfirmActionButton named
 * "Ẩn {title}" that asks first — "Ẩn mục này?" / "Mục này sẽ không xuất hiện trong kế hoạch từ
 * ngày mai." — then sends `{ requestId, itemId }` (the render's request id: a double tap hides
 * once). The re-rendered tab moves the item to the hidden ones, so the answer then comes as a
 * toast.
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
  return (
    <ConfirmActionButton
      icon={EyeOff}
      label={copy.action}
      ariaLabel={withTitle(copy.actionLabel, title)}
      dialog={{ title: copy.title, description: copy.description, confirm: copy.confirm }}
      send={() => action({ requestId, itemId })}
    />
  )
}

export { HideCustomItemButton }
