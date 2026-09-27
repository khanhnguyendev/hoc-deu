'use client'

import { Plus } from 'lucide-react'
import Link from 'next/link'
import { ActionStatus, useActionFeedback } from '@/components/patterns/action-feedback'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { fill, formatNumber } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'
import type { ExtraResult } from '../actions'
import type { ExtraView } from '../view-model'

const copy = vi.extra.add

/** `addExtraAction`, passed unbound from the page. */
export type AddExtraAction = (input: { requestId: string; trackId: string }) => Promise<ExtraResult>

/**
 * "Học thêm" for one track (decision 20, §5.9): the track chip and an outline button (the one
 * primary on `/today` stays check-in) that sends `{ requestId, trackId }` — the render's request
 * id, so a double tap adds once (decision 16) — through `useActionFeedback` (UI I-3): pending while
 * the action and the re-render run, a failed request said beside the button (never the error
 * boundary). The button stays after a success (the new extra block appears above it), so the
 * answer is in its own polite region — not also a toast (m-4); a stale answer whose re-render
 * removes "Học thêm" (the plan is now paused) is a toast, focus on the plan's heading. When the plan's snapshot caps the track
 * at 0 new items (§5.5) there is no button: it says why, truthfully — the plan-time due count, and
 * no new items for this plan (ruling M5-R33 M-5) — and links to the track's review queue. The
 * surface is the `Card` primitive.
 */
function ExtraButton({
  view,
  requestId,
  action,
}: {
  view: ExtraView
  requestId: string
  action: AddExtraAction
}) {
  const feedback = useActionFeedback()

  const onClick = () => {
    feedback.run(() => action({ requestId, trackId: view.trackId }))
  }

  return (
    <Card data-slot="extra-button" data-accent={view.accent} className="gap-2 md:gap-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Badge tone="track">{view.trackTitle}</Badge>
        {view.throttledDue === null && (
          <Button variant="outline" loading={feedback.pending} onClick={onClick}>
            <Plus aria-hidden="true" strokeWidth={1.75} />
            {copy.action} <span className="sr-only">{view.trackTitle}</span>
          </Button>
        )}
      </div>
      {view.throttledDue === null ? (
        <ActionStatus feedback={feedback} spacing="none" />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm">{fill(copy.throttled, { n: formatNumber(view.throttledDue) })}</p>
          <Link
            href={`/review?${new URLSearchParams({ track: view.trackId }).toString()}`}
            className={buttonVariants({ variant: 'outline' })}
          >
            {copy.review} <span className="sr-only">{view.trackTitle}</span>
          </Link>
        </div>
      )}
    </Card>
  )
}

export { ExtraButton }
