'use client'

import { useState } from 'react'
import { Banner } from '@/components/patterns/banner'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { FormActions } from '@/components/patterns/form-actions'
import { Button } from '@/components/ui/button'
import { vi } from '@/lib/i18n/vi'
import type { SettingsAction } from '../schema'
import { failureOf, useSettingsAction } from './use-settings-action'

const copy = vi.settings.deleteAccount

type DeleteAccountProps = {
  deleteAccount: SettingsAction
}

/**
 * "Xoá tài khoản" (§4.6): the backup-retention notice, and a destructive button that asks first
 * ("what is deleted" is the Section's own description, above this). A successful delete redirects
 * away (to the landing page's deleted notice), so only a failure is ever seen here — it stays in
 * an always-mounted `role="alert"` region, and closes the dialog, like a status change in
 * TrackSettings.
 */
function DeleteAccount({ deleteAccount }: DeleteAccountProps) {
  const [confirming, setConfirming] = useState(false)
  const { result, pending, run } = useSettingsAction(deleteAccount)
  const failure = failureOf(result)
  const [handled, setHandled] = useState(result)
  // A new result: the delete attempt is over (it failed — success never returns), so the dialog
  // closes and the failure shows next to the button.
  if (result !== handled) {
    setHandled(result)
    setConfirming(false)
  }

  return (
    <div data-slot="delete-account" className="flex flex-col gap-4">
      <Banner tone="info">{copy.privacy}</Banner>
      <FormActions error={failure}>
        <Button variant="destructive" onClick={() => setConfirming(true)}>
          {copy.confirm}
        </Button>
      </FormActions>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={copy.confirmDialog.title}
        description={copy.confirmDialog.description}
        confirmLabel={copy.confirm}
        tone="destructive"
        pending={pending}
        onConfirm={() => run(new FormData())}
      />
    </div>
  )
}

export { DeleteAccount }
export type { DeleteAccountProps }
