'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { FormActions } from '@/components/patterns/form-actions'
import { FormField } from '@/components/patterns/form-field'
import { isNavigationError } from '@/components/patterns/navigation-error'
import { SwitchField } from '@/components/patterns/switch-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toaster'
import { fill, formatNumber } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'
import type { AdminActionResult, BotSettingsInput } from '../actions'
import type { BotControlsView } from '../bot'
import { useSavedSwitch } from './use-saved-switch'

const copy = vi.adminBot.controls

type Update = (input: BotSettingsInput) => Promise<AdminActionResult>
type SwitchKey = 'enabled' | 'dryRun' | 'contentProposals'

/** One switch, saved on its own the moment it changes (§2.4: each control is its own form). */
function SettingSwitch({
  name,
  saved,
  update,
}: {
  name: SwitchKey
  saved: boolean
  update: Update
}) {
  const { value, pending, error, change } = useSavedSwitch(saved, (next) =>
    update({ [name]: next }),
  )
  return (
    <SwitchField
      id={`bot-${name}`}
      label={copy[name].label}
      description={copy[name].description}
      error={error}
      checked={value}
      pending={pending}
      onCheckedChange={change}
    />
  )
}

/** The per-run user cap (1–`max`), a number field saved by its own "Lưu". */
function CapForm({ saved, max, update }: { saved: number; max: number; update: Update }) {
  const [value, setValue] = useState(String(saved))
  const [lastSaved, setLastSaved] = useState(saved)
  const [invalid, setInvalid] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // The page re-rendered with another saved cap (this save, or another admin's): follow it — unless
  // the admin has typed something else since, which stays, with its error (the save's re-render can
  // land after the next edit: e2e fix round 2).
  if (saved !== lastSaved) {
    setLastSaved(saved)
    if (value === String(lastSaved) || value === String(saved)) {
      setValue(String(saved))
      setInvalid(false)
    }
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const cap = Number(value)
    if (value.trim() === '' || !Number.isInteger(cap) || cap < 1 || cap > max) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    setError(null)
    startTransition(async () => {
      let result: AdminActionResult
      try {
        result = await update({ perRunUserCap: cap })
      } catch (caught) {
        if (isNavigationError(caught)) return
        result = { ok: false, message: vi.errors.saveFailed }
      }
      if (!result.ok) setError(result.message)
      toast(result.message)
    })
  }

  const maxText = formatNumber(max)
  return (
    <form data-slot="bot-cap-form" noValidate onSubmit={submit} className="flex flex-col gap-3">
      <FormField
        id="bot-per-run-user-cap"
        label={copy.cap.label}
        description={fill(copy.cap.description, { max: maxText })}
        error={invalid ? fill(copy.cap.invalid, { max: maxText }) : undefined}
      >
        {(control) => (
          <Input
            {...control}
            type="number"
            inputMode="numeric"
            min={1}
            max={max}
            step={1}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="max-w-40"
          />
        )}
      </FormField>
      <FormActions error={error}>
        <Button type="submit" variant="secondary" loading={pending}>
          {copy.cap.save}
        </Button>
      </FormActions>
    </form>
  )
}

/**
 * `/admin/bot`'s controls (§2.4, §6.2): "Bật bot" (`enabled` — the kill switch's row lock), "Chạy
 * thử (dry-run)" (`dry_run`), "Đề xuất nội dung" (`content_proposals`) — each switch saved on its
 * own at once — and the per-run user cap (1–100, its hard maximum shown), saved by its own form.
 * Every save answers with a toast; a failure also stays beside its control. The server action
 * comes in as a prop, so the catalog renders it with a stub.
 */
function BotControls({
  controls,
  updateBotSettings,
}: {
  controls: BotControlsView
  updateBotSettings: Update
}) {
  return (
    <div data-slot="bot-controls" className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <SettingSwitch name="enabled" saved={controls.enabled} update={updateBotSettings} />
        <SettingSwitch name="dryRun" saved={controls.dryRun} update={updateBotSettings} />
        <SettingSwitch
          name="contentProposals"
          saved={controls.contentProposals}
          update={updateBotSettings}
        />
      </div>
      <CapForm saved={controls.perRunUserCap} max={controls.capMax} update={updateBotSettings} />
    </div>
  )
}

export { BotControls }
