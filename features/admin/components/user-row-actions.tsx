'use client'

import { CircleAlert } from 'lucide-react'
import { useEffect, useRef, useState, useTransition } from 'react'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { Button, type ButtonProps } from '@/components/ui/button'
import { toast } from '@/components/ui/toaster'
import type { AccountStatus, Role } from '@/lib/auth/dal'
import { vi } from '@/lib/i18n/vi'
import type { AdminActionResult } from '../actions'
import { userRowId } from './user-row-id'

type Action = keyof typeof vi.admin.actions
/** The actions that ask first (§2.4 task 2.8): rejecting, suspending and changing a role. */
type ConfirmedAction = keyof typeof vi.admin.confirm

const isConfirmed = (action: Action): action is ConfirmedAction =>
  Object.hasOwn(vi.admin.confirm, action)

/** The transitions of decision 17 (and the role change for active accounts), per status. */
function actionsFor(status: AccountStatus, role: Role): Action[] {
  switch (status) {
    case 'pending':
      return ['approve', 'reject']
    case 'active':
      return ['suspend', role === 'admin' ? 'demote' : 'promote']
    case 'suspended':
    case 'rejected':
      return ['reactivate']
  }
}

const VARIANT: Record<Action, ButtonProps['variant']> = {
  approve: 'secondary',
  reactivate: 'secondary',
  reject: 'outline',
  suspend: 'outline',
  promote: 'outline',
  demote: 'outline',
}

// A replacer function: a display name is user text, and a replacement string would expand `$&`.
const withName = (text: string, name: string) => text.replace('{name}', () => name)

/** The role button keeps one key through promote ↔ demote, so it stays the same element. */
const slotOf = (action: Action) => (action === 'promote' || action === 'demote' ? 'role' : action)

type RowState = { userId: string; status: AccountStatus; role: Role }

/**
 * The row whose next render in a different status or role takes keyboard focus (WCAG 2.4.3). An
 * action usually moves its row to another section, which unmounts this component and mounts a new
 * one there — so the note lives outside the component. One slot: a newer action replaces it.
 */
let followed: RowState | null = null

/** Notes the row's state before an action. */
function followRow(row: RowState): void {
  followed = row
}

/** Whether `row` is the followed row, now shown in another state; clears the note if so. */
function takeFollowedRow(row: RowState): boolean {
  if (followed?.userId !== row.userId) return false
  if (followed.status === row.status && followed.role === row.role) return false
  followed = null
  return true
}

/** Focuses the row's target (UserQueue); false when there is none (e.g. the catalog's demos). */
function focusRow(userId: string): boolean {
  const target = document.getElementById(userRowId(userId))
  if (!target) return false
  target.focus({ preventScroll: true })
  target.scrollIntoView({ block: 'nearest' })
  return true
}

/**
 * One account's buttons in the approval queue: approve and reactivate run at once; reject,
 * suspend and the role changes confirm first. The result is a polite toast — and, when it failed,
 * also a line in the row, since a toast is never the only feedback for a failure (DESIGN_SYSTEM
 * §9). Keyboard focus follows the row once the list shows it in its new state, and returns to the
 * pressed button when the dialog is cancelled. The server actions come in as props, so the catalog
 * renders it with no-ops.
 */
function UserRowActions({
  user,
  setUserStatus,
  setUserRole,
}: {
  user: { id: string; name: string; status: AccountStatus; role: Role }
  setUserStatus: (
    userId: string,
    status: 'active' | 'rejected' | 'suspended',
  ) => Promise<AdminActionResult>
  setUserRole: (userId: string, role: Role) => Promise<AdminActionResult>
}) {
  const [pending, startTransition] = useTransition()
  const [running, setRunning] = useState<Action | null>(null)
  // The dialog keeps its action while it closes, so its copy stays put during the exit animation.
  const [dialog, setDialog] = useState<{ action: ConfirmedAction; open: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Read by the dialog's close handler, which may run after this row has moved (and unmounted).
  const succeeded = useRef(false)

  // On mount (the row moved here) or when this row's status or role changed in place.
  useEffect(() => {
    if (takeFollowedRow({ userId: user.id, status: user.status, role: user.role })) {
      focusRow(user.id)
    }
  }, [user.id, user.status, user.role])

  const perform = (action: Action): Promise<AdminActionResult> => {
    switch (action) {
      case 'approve':
      case 'reactivate':
        return setUserStatus(user.id, 'active')
      case 'reject':
        return setUserStatus(user.id, 'rejected')
      case 'suspend':
        return setUserStatus(user.id, 'suspended')
      case 'promote':
        return setUserRole(user.id, 'admin')
      case 'demote':
        return setUserRole(user.id, 'learner')
    }
  }

  const run = (action: Action) => {
    setRunning(action)
    setError(null)
    succeeded.current = false
    // Noted before the call: the re-rendered list may arrive before the action's result does.
    followRow({ userId: user.id, status: user.status, role: user.role })
    startTransition(async () => {
      let result: AdminActionResult
      try {
        result = await perform(action)
      } catch {
        // A thrown action (network, session) must not reach the route's error boundary.
        result = { ok: false, message: vi.admin.errors.failed }
      }
      succeeded.current = result.ok
      // `running` stays set: with `pending` it marks the pressed button busy until the transition
      // ends. Clearing it here would disable that button while `pending` is still true, and the
      // dialog could not return focus to it.
      setDialog((current) => current && { ...current, open: false })
      if (!result.ok) setError(result.message)
      toast(result.message)
    })
  }

  return (
    <div data-slot="user-row-actions" className="flex flex-col items-start gap-2 md:items-end">
      <div
        role="group"
        aria-label={withName(vi.admin.users.actionsFor, user.name)}
        className="flex flex-wrap gap-2"
      >
        {actionsFor(user.status, user.role).map((action) => (
          <Button
            key={slotOf(action)}
            variant={VARIANT[action]}
            loading={pending && running === action}
            disabled={pending && running !== action}
            onClick={() => (isConfirmed(action) ? setDialog({ action, open: true }) : run(action))}
          >
            {vi.admin.actions[action]}
          </Button>
        ))}
      </div>
      {error && (
        <p className="flex items-center gap-1.5 text-sm text-danger">
          <CircleAlert aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0" />
          {error}
        </p>
      )}
      {dialog && (
        <ConfirmDialog
          open={dialog.open}
          onOpenChange={(open) => setDialog({ ...dialog, open })}
          title={withName(vi.admin.confirm[dialog.action].title, user.name)}
          description={vi.admin.confirm[dialog.action].description}
          confirmLabel={vi.admin.actions[dialog.action]}
          tone={dialog.action === 'promote' ? 'default' : 'destructive'}
          pending={pending}
          onConfirm={() => run(dialog.action)}
          // After a success focus goes to the row (the button may be gone); otherwise ConfirmDialog
          // returns it to the button that opened the dialog.
          onCloseAutoFocus={(event) => {
            if (succeeded.current && focusRow(user.id)) event.preventDefault()
          }}
        />
      )}
    </div>
  )
}

export { UserRowActions }
