'use client'

import { Clock, Send } from 'lucide-react'
import { useEffect, useId, useRef, useState, useTransition } from 'react'
import { isNavigationError } from '@/components/patterns/navigation-error'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/toaster'
import { withTitle } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'
import type { AdminActionResult } from '../actions'
import type { PendingPublish } from '../content'

const copy = vi.publish

type Checks = readonly [boolean, boolean, boolean]
const UNTICKED: Checks = [false, false, false]

export type PublishButtonProps = {
  /** The publish target: the item ID, or `<itemId>#note` (§6.6). */
  target: string
  title: string
  /** `en` for an English title (a LeetCode title, an English card front). */
  titleLang?: 'en' | 'vi' | undefined
  /** A problem or its note gets §6.6's checklist; any other item the same checks in its terms. */
  checklist: 'problem' | 'item'
  /** The target's pending request, or null. */
  request: PendingPublish | null
  /** The server actions, as props so the component catalog passes stubs; absent: state only. */
  requestPublish?: ((target: string) => Promise<AdminActionResult>) | undefined
  cancelPublish?: ((requestId: number) => Promise<AdminActionResult>) | undefined
}

/** Runs an action; a thrown error (not a redirect) reads as a failed save. */
async function run(action: () => Promise<AdminActionResult>): Promise<AdminActionResult | null> {
  try {
    return await action()
  } catch (caught) {
    if (isNavigationError(caught)) return null
    return { ok: false, message: vi.errors.saveFailed }
  }
}

/**
 * "Xuất bản" for a draft item or draft note on `/admin/content` (§2.4, §6.6; ADR-0024; task
 * 6.7a). The button opens the publish checklist — three checkboxes, all required before "Xuất bản"
 * is enabled (the `tests.yaml` examples match LeetCode, the explanation and complexity are right,
 * the bilingual line reads naturally) — and records a publish request; a bot publish run then
 * opens the PR that flips the status. A pending request shows "Đang chờ xuất bản", its PR link
 * once a run included it, and "Huỷ". Focus moves to the control that replaces the one used.
 */
function PublishButton({
  target,
  title,
  titleLang,
  checklist,
  request,
  requestPublish,
  cancelPublish,
}: PublishButtonProps) {
  const [open, setOpen] = useState(false)
  const [checks, setChecks] = useState<Checks>(UNTICKED)
  const [pending, startTransition] = useTransition()
  /**
   * After a successful action: the request id it started from. Once the `request` prop differs
   * (the page re-rendered with the new state), that state's control takes focus (WCAG 2.4.3).
   */
  const [focusFrom, setFocusFrom] = useState<{ from: number | null } | null>(null)
  const publishRef = useRef<HTMLButtonElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const id = useId()
  const lines = copy.dialog[checklist]
  const complete = checks.every(Boolean)

  const currentId = request?.requestId ?? null
  useEffect(() => {
    if (focusFrom === null || currentId === focusFrom.from) return
    const next = currentId === null ? publishRef.current : cancelRef.current
    if (next === null) return
    next.focus()
    setFocusFrom(null)
  }, [focusFrom, currentId])

  const openChange = (next: boolean) => {
    if (pending) return
    if (next) setChecks(UNTICKED)
    setOpen(next)
  }

  const publish = () => {
    if (!complete || requestPublish === undefined) return
    const from = currentId
    startTransition(async () => {
      const result = await run(() => requestPublish(target))
      if (result === null) return
      setOpen(false)
      toast(result.message)
      if (result.ok) setFocusFrom({ from })
    })
  }

  const cancel = () => {
    if (request === null || cancelPublish === undefined) return
    const from = request.requestId
    startTransition(async () => {
      const result = await run(() => cancelPublish(request.requestId))
      if (result === null) return
      toast(result.message)
      if (result.ok || result.stale) setFocusFrom({ from })
    })
  }

  if (request !== null) {
    return (
      <div
        data-slot="publish-button"
        data-state="pending"
        className="flex flex-wrap items-center gap-x-3 gap-y-1"
      >
        <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0" />
          {copy.pending}
        </span>
        {request.pr !== null && (
          <Button asChild variant="link">
            <a href={request.pr.href} target="_blank" rel="noopener noreferrer">
              {request.pr.label} <span className="sr-only">{vi.content.newTab}</span>
            </a>
          </Button>
        )}
        {cancelPublish !== undefined && (
          <Button
            ref={cancelRef}
            type="button"
            variant="outline"
            loading={pending}
            aria-label={withTitle(copy.cancelFor, title)}
            onClick={cancel}
          >
            {copy.cancel}
          </Button>
        )}
      </div>
    )
  }

  if (requestPublish === undefined) return null

  return (
    <div data-slot="publish-button" data-state="draft" className="flex items-center">
      <Button
        ref={publishRef}
        type="button"
        variant="outline"
        aria-label={withTitle(copy.buttonFor, title)}
        onClick={() => openChange(true)}
      >
        <Send aria-hidden="true" strokeWidth={1.75} />
        {copy.button}
      </Button>
      <Dialog open={open} onOpenChange={openChange}>
        <DialogContent
          showCloseButton={false}
          // Focus goes back to "Xuất bản" on a close — unless a request succeeded, when the
          // pending state's "Huỷ" takes it (the effect above).
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            if (focusFrom === null) publishRef.current?.focus()
          }}
          onInteractOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => pending && event.preventDefault()}
        >
          <DialogHeader className="pr-0">
            <DialogTitle>
              {/* "Xuất bản {title}?" with the title in its own language. */}
              {copy.dialog.title.split('{title}').flatMap((part, index) =>
                index === 0
                  ? [part]
                  : [
                      <span key={index} lang={titleLang}>
                        {title}
                      </span>,
                      part,
                    ],
              )}
            </DialogTitle>
            <DialogDescription>{copy.dialog.description}</DialogDescription>
          </DialogHeader>
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-3 text-sm font-medium">{copy.dialog.checklist}</legend>
            {lines.map((line, index) => (
              <div key={line} className="flex items-start gap-3">
                <Checkbox
                  id={`${id}-check-${index}`}
                  className="mt-0.5"
                  checked={checks[index]}
                  disabled={pending}
                  onCheckedChange={(value) =>
                    setChecks(
                      (current) =>
                        current.map((checked, at) =>
                          at === index ? value === true : checked,
                        ) as unknown as Checks,
                    )
                  }
                />
                <Label htmlFor={`${id}-check-${index}`} className="font-normal">
                  {line}
                </Label>
              </div>
            ))}
          </fieldset>
          {!complete && (
            <p id={`${id}-incomplete`} className="text-sm text-muted-foreground">
              {copy.dialog.incomplete}
            </p>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={pending}>
                {vi.common.cancel}
              </Button>
            </DialogClose>
            <Button
              disabled={!complete}
              loading={pending}
              aria-describedby={complete ? undefined : `${id}-incomplete`}
              onClick={publish}
            >
              {copy.button}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export { PublishButton }
