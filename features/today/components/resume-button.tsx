'use client'

import { ActionStatus, useActionFeedback } from '@/components/patterns/action-feedback'
import { Button } from '@/components/ui/button'
import { vi } from '@/lib/i18n/vi'
import type { ResumeResult } from '../actions'

export type ResumeAction = () => Promise<ResumeResult>

/**
 * "Học tiếp hôm nay" (§5.8): calls `resumeTodayAction` (an unbound prop from the page) through
 * `useActionFeedback` (UI I-3) — pending while the action and the re-render run (a second click
 * sends nothing), a failed request said beside the button, never the error boundary. The action
 * revalidates `/today`, so a success — or "not offered", when another tab changed the plan —
 * usually replaces the paused view and this button: the answer is then a toast, and focus moves to
 * the plan's heading; while the button stays, the answer is in its own polite region.
 */
function ResumeButton({ resume }: { resume: ResumeAction }) {
  const feedback = useActionFeedback()
  return (
    <div data-slot="resume-button" className="flex flex-col items-start">
      <Button onClick={() => feedback.run(resume)} loading={feedback.pending}>
        {vi.today.paused.resume}
      </Button>
      <ActionStatus feedback={feedback} />
    </div>
  )
}

export { ResumeButton }
