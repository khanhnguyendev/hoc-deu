'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toaster'
import { vi } from '@/lib/i18n/vi'
import type { ResumeResult } from '../actions'

export type ResumeAction = () => Promise<ResumeResult>

/**
 * "Học tiếp hôm nay" (§5.8): calls `resumeTodayAction` (an unbound prop from the page), pending
 * while it runs (a second click is ignored), and puts the answer in a polite live region beside
 * the button. The action revalidates `/today`, so a success usually replaces the paused view — and
 * this button — with today's plan: a success is also a toast, which outlives the re-render. A
 * failure stays next to the button (a toast is never the only feedback for a failure).
 */
function ResumeButton({ resume }: { resume: ResumeAction }) {
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState('')

  const onClick = () => {
    if (pending) return
    startTransition(async () => {
      const result = await resume()
      setMessage(result.message)
      if (result.ok) toast(result.message)
    })
  }

  return (
    <div data-slot="resume-button" className="flex flex-col items-start gap-2">
      <Button onClick={onClick} loading={pending}>
        {vi.today.paused.resume}
      </Button>
      <p role="status" aria-live="polite" className="text-sm">
        {message}
      </p>
    </div>
  )
}

export { ResumeButton }
