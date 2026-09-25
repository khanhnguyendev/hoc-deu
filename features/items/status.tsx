/**
 * The parts every Row shares (§3.3, DESIGN_SYSTEM §3.3): the "Bản nháp" / "Đã ngừng" badge and,
 * with `showStatus`, the learner's status pill ("Chưa học" until item state exists).
 */
import type * as React from 'react'
import { StatusPill, type PillStatus } from '@/components/patterns/status-pill'
import type { ItemStatus } from '@/lib/content/schemas/common'
import { ItemStatusBadge } from './components/item-status-badge'
import type { ItemStateView } from './types'

/** The pill for a learner's state: `null` (never studied) reads "Chưa học". */
export function pillStatusOf(state: ItemStateView | null): PillStatus {
  return state === null ? 'not-started' : state.status
}

/** `trailing` for a Row's LinkRow: the status pill when asked for, else nothing. */
export function rowStatus(state: ItemStateView | null, showStatus = false): React.ReactNode {
  return showStatus ? <StatusPill status={pillStatusOf(state)} /> : undefined
}

/** `badges` for a Row's LinkRow: the type's own badges, then the item-status badge. */
export function rowBadges(status: ItemStatus, own?: React.ReactNode): React.ReactNode {
  return (
    <>
      {own}
      <ItemStatusBadge status={status} />
    </>
  )
}
