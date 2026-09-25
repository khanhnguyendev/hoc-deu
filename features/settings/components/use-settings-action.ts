import { startTransition, useActionState } from 'react'
import type * as React from 'react'
import { toast } from '@/components/ui/toaster'
import type { SettingsAction, SettingsResult } from '../schema'

/**
 * One settings action as form state: the last result (`null` before the first run), whether it is
 * running, and ways to run it. A success is a polite toast (DESIGN_SYSTEM §9); a failure stays in
 * the result for the form to show, because a toast is never the only feedback for a failed save.
 *
 * Forms submit through `onSubmit`, not `<form action>`: React 19 resets a form after each form
 * action, and these forms keep their values in state, re-synced from the saved values when the
 * page re-renders. A second submit while one is running is ignored.
 */
export function useSettingsAction(action: SettingsAction): {
  result: SettingsResult | null
  pending: boolean
  run: (formData: FormData) => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
} {
  const [result, dispatch, pending] = useActionState<SettingsResult | null, FormData>(
    async (previous, formData) => {
      const next = await action(previous, formData)
      if (next.ok) toast(next.message)
      return next
    },
    null,
  )
  const run = (formData: FormData) => startTransition(() => dispatch(formData))
  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!pending) run(new FormData(event.currentTarget))
  }
  return { result, pending, run, onSubmit }
}

/** The failed result's field errors, or none. */
export const fieldErrorsOf = (result: SettingsResult | null): Record<string, string> =>
  result?.ok === false ? (result.fieldErrors ?? {}) : {}

/** The failed result's message, or null. */
export const failureOf = (result: SettingsResult | null): string | null =>
  result?.ok === false ? result.message : null
