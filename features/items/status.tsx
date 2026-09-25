/**
 * The parts every Row shares (§3.3, DESIGN_SYSTEM §3.3): the "Bản nháp" / "Đã ngừng" badge and,
 * with `showStatus`, the learner's status pill ("Chưa học" until item state exists).
 */
import { Fragment } from 'react'
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

/**
 * `badges` for a Row's LinkRow: the type's own badges (falsy ones dropped), then the item-status
 * badge — separated by spaces, so the row's accessible name reads them as words.
 */
export function rowBadges(
  status: ItemStatus,
  own: readonly React.ReactNode[] = [],
): React.ReactNode {
  const badges = [...own, <ItemStatusBadge key="status" status={status} />].filter(
    (badge) => badge !== null && badge !== undefined && badge !== false,
  )
  return badges.map((badge, index) => (
    // A fixed, ordered list: the position is its identity.
    <Fragment key={index}>
      {index > 0 && ' '}
      {badge}
    </Fragment>
  ))
}
