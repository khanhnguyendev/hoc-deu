'use client'

import { CircleAlert } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { AccountStatus } from '@/lib/auth/dal'
import { vi } from '@/lib/i18n/vi'
import type { AdminActionResult } from '../actions'
import { useSavedSwitch } from './use-saved-switch'

const copy = vi.adminBot.aiFlag

/**
 * The AI flag of one account in `/admin/users` (§2.4, decision 34): a switch with a visible label,
 * saved at once by `setAiFlag` (the row re-renders with the saved value); usable for `active`
 * accounts only — any other account shows it disabled, with the reason. The admin's own row has it
 * too (the owner is the first AI learner). The server action comes in as a prop.
 */
function AiFlagToggle({
  user,
  setAiFlag,
}: {
  user: { id: string; name: string; status: AccountStatus; aiPersonalization: boolean }
  setAiFlag: (userId: string, on: boolean) => Promise<AdminActionResult>
}) {
  const { value, pending, error, change } = useSavedSwitch(user.aiPersonalization, (next) =>
    setAiFlag(user.id, next),
  )
  const active = user.status === 'active'
  const id = `ai-flag-${user.id}`
  const describedBy = [!active && `${id}-inactive`, error && `${id}-error`]
    .filter(Boolean)
    .join(' ')

  return (
    <div data-slot="ai-flag-toggle" className="flex flex-col gap-1">
      <div className="flex items-center gap-3">
        <Switch
          id={id}
          checked={value}
          disabled={!active}
          aria-busy={pending || undefined}
          aria-describedby={describedBy || undefined}
          onCheckedChange={change}
        />
        <Label htmlFor={id}>{copy.label}</Label>
      </div>
      {!active && (
        <p id={`${id}-inactive`} className="text-sm text-muted-foreground">
          {copy.inactive}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="flex items-center gap-1.5 text-sm text-danger">
          <CircleAlert aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}

export { AiFlagToggle }
