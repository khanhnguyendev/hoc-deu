'use client'

import { RotateCcw, SkipForward } from 'lucide-react'
import { useRef, useState } from 'react'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { Button } from '@/components/ui/button'
import { vi } from '@/lib/i18n/vi'
import { itemActionsFor, type OutcomeBinding } from '../../outcome'
import { OutcomeMessage } from './grade-buttons'
import { useOutcome } from './use-outcome'

const copy = vi.outcomes.actions

/**
 * What every item page offers besides its result (§5.7): "Bỏ qua mục này" while the item is not
 * introduced or is due — asked first in a ConfirmDialog, then `item.skipped` (the item counts as
 * handled for its block and leaves review) — and "Ôn lại" on a mastered item (`item.readded`: back
 * in review, due today). Rendered by ItemPageFrame under the page's body. Nothing when neither
 * applies; the last answer stays in its polite live region after the page re-renders without the
 * action, and a confirmed skip moves focus there (the button it came from is gone).
 */
function ItemActions({ binding }: { binding: OutcomeBinding }) {
  const [confirming, setConfirming] = useState(false)
  const confirmed = useRef(false)
  const message = useRef<HTMLParagraphElement>(null)
  const { pending, sent, send } = useOutcome<'skip' | 'readd'>(binding)
  const { skip, readd } = itemActionsFor(binding)
  if (!skip && !readd && sent === null) return null

  return (
    <div
      data-slot="item-actions"
      className="flex flex-col items-start gap-2 border-t border-border pt-4"
    >
      {readd && (
        <>
          <p className="text-sm text-muted-foreground">{copy.readdBody}</p>
          <Button
            variant="outline"
            loading={pending === 'readd'}
            onClick={() => send({ type: 'item.readded' }, 'readd')}
          >
            <RotateCcw aria-hidden="true" strokeWidth={1.75} />
            {copy.readd}
          </Button>
        </>
      )}
      {skip && (
        <>
          <Button variant="ghost" onClick={() => setConfirming(true)}>
            <SkipForward aria-hidden="true" strokeWidth={1.75} />
            {copy.skip}
          </Button>
          <ConfirmDialog
            open={confirming}
            onOpenChange={setConfirming}
            title={copy.skipTitle}
            description={copy.skipBody}
            confirmLabel={copy.skipConfirm}
            pending={pending === 'skip'}
            onConfirm={() => {
              confirmed.current = true
              send({ type: 'item.skipped' }, 'skip', () => setConfirming(false))
            }}
            onCloseAutoFocus={(event) => {
              // After a confirmed skip the page re-renders without this button: focus the answer.
              if (!confirmed.current) return
              confirmed.current = false
              event.preventDefault()
              message.current?.focus()
            }}
          />
        </>
      )}
      <OutcomeMessage
        ref={message}
        result={sent}
        label={sent === null ? undefined : sent.key === 'skip' ? copy.skip : copy.readd}
      />
    </div>
  )
}

export { ItemActions }
