'use client'

import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { vi } from '@/lib/i18n/vi'

/**
 * Asks before an important or destructive action; announced as an alert dialog. It is opened
 * without a DialogTrigger, so on close it returns focus to the control that had it when it opened
 * (Radix would focus its empty trigger ref, dropping focus to `<body>`) — unless
 * `onCloseAutoFocus` moves focus itself and calls `event.preventDefault()`.
 */
function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = vi.common.cancel,
  tone = 'default',
  pending = false,
  onConfirm,
  onCloseAutoFocus,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel: string
  cancelLabel?: string
  tone?: 'default' | 'destructive'
  pending?: boolean
  onConfirm: () => void
  /** Runs when the dialog has closed; `event.preventDefault()` keeps focus where it put it. */
  onCloseAutoFocus?: (event: Event) => void
}) {
  const opener = useRef<HTMLElement | null>(null)
  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent
        role="alertdialog"
        showCloseButton={false}
        onOpenAutoFocus={() => {
          opener.current =
            document.activeElement instanceof HTMLElement ? document.activeElement : null
        }}
        onCloseAutoFocus={(event) => {
          onCloseAutoFocus?.(event)
          if (event.defaultPrevented) return
          event.preventDefault()
          opener.current?.focus()
        }}
        // An alert dialog needs an explicit answer: no dismissal by clicking outside, and no
        // Escape while the action runs.
        onInteractOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => pending && event.preventDefault()}
      >
        <DialogHeader className="pr-0">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={pending}>
              {cancelLabel}
            </Button>
          </DialogClose>
          <Button
            variant={tone === 'destructive' ? 'destructive' : 'primary'}
            loading={pending}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { ConfirmDialog }
