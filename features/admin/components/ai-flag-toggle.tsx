'use client'

import { SwitchField } from '@/components/patterns/switch-field'
import type { AccountStatus } from '@/lib/auth/dal'
import { fill } from '@/lib/i18n/format'
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
  return (
    <SwitchField
      id={`ai-flag-${user.id}`}
      label={copy.label}
      // The visible label, then the account: each row's switch has its own name (label in name).
      ariaLabel={`${copy.label} ${fill(copy.forName, { name: user.name })}`}
      description={active ? undefined : copy.inactive}
      error={error}
      checked={value}
      disabled={!active}
      pending={pending}
      onCheckedChange={change}
    />
  )
}

export { AiFlagToggle }
