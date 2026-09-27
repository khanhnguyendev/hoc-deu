'use client'

import { useState, useTransition } from 'react'
import { vi } from '@/lib/i18n/vi'
import { outcomeInput, type Outcome, type OutcomeBinding } from '../../outcome'

/** The last answer: which control sent it (`key`), whether it saved, and what to say. */
export type SentOutcome<K extends string> = {
  readonly key: K
  readonly ok: boolean
  readonly message: string
  /** Counts the answers, so the live region re-announces a repeated message. */
  readonly seq: number
}

/**
 * Sends a page's outcomes through its binding (task 5.2c): builds the `OutcomeInput` (the render's
 * request id, the item, its block), calls the unbound server action in a transition — a second
 * send while one runs is ignored — and keeps the answer: the server's message (saved, auto
 * checked in, or why not), or "Chưa lưu được kết quả" when the call itself failed. A retry within
 * the same render resends the same request id, so the server records the event once (decision 16).
 * `key` names the control (a grade) so it can show busy, then pressed. Sending the key that is
 * already saved sends nothing — after a save the page re-renders with a new request id, so pressing
 * the saved grade again would otherwise record a second event — but it is never silent: the live
 * region says "Kết quả này đã được lưu." again (m-10).
 */
export function useOutcome<K extends string>(
  binding: Pick<OutcomeBinding, 'requestId' | 'itemId' | 'blockId' | 'record'>,
) {
  const [pending, startTransition] = useTransition()
  const [sending, setSending] = useState<K | null>(null)
  const [sent, setSent] = useState<SentOutcome<K> | null>(null)
  const [saved, setSaved] = useState<K | null>(null)

  const send = (outcome: Outcome, key: K, then?: (ok: boolean) => void) => {
    if (pending) return
    if (key === saved) {
      setSent({ key, ok: true, message: vi.outcomes.alreadySaved, seq: (sent?.seq ?? 0) + 1 })
      return
    }
    setSending(key)
    startTransition(async () => {
      let answer: SentOutcome<K>
      try {
        const result = await binding.record(outcomeInput(binding, outcome))
        answer = { key, ok: result.ok, message: result.message, seq: (sent?.seq ?? 0) + 1 }
      } catch {
        // The action never answered (offline, a server error): nothing is known to be saved.
        answer = { key, ok: false, message: vi.outcomes.failed, seq: (sent?.seq ?? 0) + 1 }
      }
      setSent(answer)
      if (answer.ok) setSaved(key)
      setSending(null)
      then?.(answer.ok)
    })
  }

  return {
    /** The control whose outcome is being sent, or null. */
    pending: pending ? sending : null,
    sent,
    /** The key of the last outcome that saved (a later failure keeps it), or null. */
    saved,
    send,
  }
}
