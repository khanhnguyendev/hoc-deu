'use client'

import { useState, useTransition } from 'react'
import { isNavigationError } from '@/components/patterns/navigation-error'
import { toast } from '@/components/ui/toaster'
import { vi } from '@/lib/i18n/vi'

/**
 * A switch whose every change is saved at once by a server action (the `/admin/bot` switches and
 * the AI flag, task 6.3): shows the new position while it saves, goes back to the saved one when
 * the save fails, and follows the saved value when the page re-renders with a new one. The answer
 * is a toast; a failure also stays beside the switch (`error`), since a toast is never the only
 * feedback for a failure (DESIGN_SYSTEM §9). A thrown action becomes "Không lưu được thay đổi…",
 * except Next's own navigation (a guard's redirect), which says nothing (M1).
 */
export function useSavedSwitch(
  saved: boolean,
  save: (next: boolean) => Promise<{ ok: boolean; message: string }>,
) {
  const [pending, startTransition] = useTransition()
  const [value, setValue] = useState(saved)
  const [lastSaved, setLastSaved] = useState(saved)
  const [error, setError] = useState<string | null>(null)

  // The page re-rendered with another saved value (this save, or another admin's): follow it.
  if (saved !== lastSaved) {
    setLastSaved(saved)
    setValue(saved)
  }

  const change = (next: boolean) => {
    if (pending) return
    setValue(next)
    setError(null)
    startTransition(async () => {
      let result: { ok: boolean; message: string }
      try {
        result = await save(next)
      } catch (caught) {
        if (isNavigationError(caught)) return
        result = { ok: false, message: vi.errors.saveFailed }
      }
      if (!result.ok) {
        setValue(saved)
        setError(result.message)
      }
      toast(result.message)
    })
  }

  return { value, pending, error, change }
}
