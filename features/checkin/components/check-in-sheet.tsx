'use client'

import { Check, Clock, Minus, Plus, RotateCcw, SkipForward, type LucideIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import * as React from 'react'
import { Banner } from '@/components/patterns/banner'
import { FormField } from '@/components/patterns/form-field'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { SheetContent } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { toast } from '@/components/ui/toaster'
import { CHECK_IN_STATUSES, type BlockState, type CheckInStatus } from '@/lib/domain/state'
import { fill, formatMinutes, formatNumber } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'
import { graphemeCount, normalizeNote, noteError, NOTE_MAX_GRAPHEMES } from '../schema'
import { editLinkOf, focusLost, type CheckInAction } from './check-in-button'

const copy = vi.checkIn.sheet

/** `block.checked_in.minutes` (§4.4): an integer 0–600. The stepper moves by 5. */
export const SHEET_MINUTES = { min: 0, max: 600, step: 5 } as const
/** Where the sheet goes back to (§2.4): `/today` without `?block=`. */
const TODAY_PATH = '/today'
const DESKTOP = '(min-width: 768px)'

const STATUS_ICON: Record<CheckInStatus, LucideIcon> = {
  done: Check,
  partial: Clock,
  skipped: SkipForward,
}

export type CheckInSheetBlock = {
  readonly id: string
  /** "Bài mới", "Ôn tập", … */
  readonly kindLabel: string
  readonly trackTitle: string
  /** The block's estimate (may be fractional: 1,5 phút per card). */
  readonly estMinutes: number
  /** `checkInMinutes(block)`: what a new check-in pre-fills. */
  readonly defaultMinutes: number
  /** The block's check-in, when it has one: an edit starts from it. */
  readonly checkIn: Pick<BlockState, 'status' | 'minutes' | 'note'> | null
}

type CheckInSheetProps = {
  action: CheckInAction
  /** The page's per-render request ID (decision 16). */
  requestId: string
  planId: string
  block: CheckInSheetBlock
  /** Closing (Esc, "Đóng", "Huỷ", a saved check-in). Default: `router.replace('/today')`. */
  onClose?: () => void
}

function useMedia(query: string): boolean {
  return React.useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/** The typed minutes as an integer 0–600, else null. */
function parseMinutes(raw: string): number | null {
  if (!/^\d{1,3}$/.test(raw.trim())) return null
  const minutes = Number(raw.trim())
  return minutes >= SHEET_MINUTES.min && minutes <= SHEET_MINUTES.max ? minutes : null
}

/** Any typed number, whole (601, -3), else null: where the stepper starts from. */
function typedNumber(raw: string): number | null {
  const value = Number(raw.trim())
  return raw.trim() === '' || !Number.isFinite(value) ? null : Math.trunc(value)
}

const clamp = (value: number) => Math.min(SHEET_MINUTES.max, Math.max(SHEET_MINUTES.min, value))

/**
 * The check-in sheet (§5.5, DESIGN_SYSTEM §9, §10): `/today?block=<id>` opens it for that block —
 * a bottom Sheet below `md`, a Dialog from `md`. Focus moves to the title; `Esc`, "Đóng" and
 * "Huỷ" go back to `/today` with `router.replace`, so the back button never reopens it (§2.4).
 * The status is a segmented control (Xong / Một phần / Bỏ qua); the minutes a stepper (0–600,
 * pre-filled with the block's check-in minutes, or `checkInMinutes` for a new check-in — "Bỏ
 * qua" sets 0, and Xong / Một phần from 0 restores the pre-filled minutes); the note is optional,
 * with a live "n/280" grapheme counter and the server's own rule (`noteError`, RF-3) beside the
 * field — a crossed limit is also announced in a polite live region, so a disabled submit always
 * has a reason. Submit sends `checkInBlock` with the page's request ID; saving, then a toast and
 * back to `/today` — or the error in a polite live region with "Thử lại", the sheet kept open.
 * Closing returns focus to the control that opened it, else (a deep link) to the block's "Sửa"
 * (DESIGN_SYSTEM §10). While closed but still mounted — `router.replace` not landed yet, which a
 * new navigation discards — a click on the block's "Sửa" opens it again.
 */
function CheckInSheet({ action, requestId, planId, block, onClose }: CheckInSheetProps) {
  const router = useRouter()
  const desktop = useMedia(DESKTOP)
  const uid = React.useId()
  const titleRef = React.useRef<HTMLHeadingElement>(null)
  const openRef = React.useRef(true)
  // In flight: `pending` is for display (React entangles every pending async transition).
  const sending = React.useRef(false)
  const [open, setOpen] = React.useState(true)
  // What had focus when `?block=` mounted the sheet: the "Sửa" link, or <body> for a deep link.
  const [opener] = React.useState(() => document.activeElement)
  // Idle, saving (`pending`: the action and the re-render it causes), or an error with "Thử lại".
  const [pending, startTransition] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)

  const initialMinutes = block.checkIn?.minutes ?? block.defaultMinutes
  const [status, setStatus] = React.useState<CheckInStatus>(block.checkIn?.status ?? 'done')
  const [minutes, setMinutes] = React.useState(String(initialMinutes))
  const [note, setNote] = React.useState(block.checkIn?.note ?? '')

  const parsedMinutes = parseMinutes(minutes)
  const minutesError = parsedMinutes === null ? copy.minutesInvalid : undefined
  const noteMessage = noteError(note) ?? undefined
  const count = graphemeCount(normalizeNote(note) ?? '')
  const invalid = parsedMinutes === null || noteMessage !== undefined

  const close = () => {
    if (!openRef.current) return
    openRef.current = false
    setOpen(false)
    if (onClose) onClose()
    else router.replace(TODAY_PATH, { scroll: false })
  }

  const chooseStatus = (value: string) => {
    // A single ToggleGroup lets the checked option be pressed off: the status never goes empty.
    const next = CHECK_IN_STATUSES.find((candidate) => candidate === value)
    if (next === undefined) return
    setStatus(next)
    if (next === 'skipped') setMinutes('0')
    else if (parsedMinutes === 0) setMinutes(String(block.defaultMinutes))
  }

  const step = (by: number) => {
    setMinutes(String(clamp(clamp(typedNumber(minutes) ?? initialMinutes) + by)))
  }

  // The replace to /today is discarded when "Sửa" starts a new navigation first: reopen here.
  React.useEffect(() => {
    if (open) return
    const reopen = (event: MouseEvent) => {
      const link =
        event.target instanceof Element ? event.target.closest('[data-check-in-edit]') : null
      if (!(link instanceof HTMLElement) || link.dataset.checkInEdit !== block.id) return
      openRef.current = true
      setError(null)
      setOpen(true)
    }
    document.addEventListener('click', reopen, true)
    return () => document.removeEventListener('click', reopen, true)
  }, [open, block.id])

  const submit = () => {
    if (sending.current || parsedMinutes === null || noteMessage !== undefined) return
    const input = {
      requestId,
      planId,
      blockId: block.id,
      status,
      minutes: parsedMinutes,
      ...(normalizeNote(note) === undefined ? {} : { note }),
    }
    sending.current = true
    setError(null)
    startTransition(async () => {
      try {
        const result = await action(input)
        if (!result.ok) {
          setError(result.message)
          return
        }
        toast(result.message)
        close()
      } catch {
        setError(vi.errors.saveFailed)
      } finally {
        sending.current = false
      }
    })
  }

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    submit()
  }

  const focusTitle = (event: Event) => {
    event.preventDefault()
    titleRef.current?.focus()
  }

  // No DialogTrigger: Radix would leave focus on <body>. The opener while it is still on the
  // page, else the block's "Sửa" (a deep link; Safari never focuses a clicked link).
  const returnFocus = (event: Event) => {
    event.preventDefault()
    if (opener instanceof HTMLElement && opener !== document.body && opener.isConnected) {
      opener.focus()
    } else if (focusLost()) {
      editLinkOf(block.id)?.focus()
    }
  }

  const statusLabelId = `${uid}-status`
  const body = (
    <>
      <DialogHeader>
        <DialogTitle ref={titleRef} tabIndex={-1}>
          {fill(copy.title, { kind: block.kindLabel })}
        </DialogTitle>
        <DialogDescription>
          {fill(copy.description, {
            track: block.trackTitle,
            minutes: formatMinutes(block.estMinutes),
          })}
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <p id={statusLabelId} className="text-sm font-medium">
            {copy.status}
          </p>
          <ToggleGroup
            type="single"
            value={status}
            onValueChange={chooseStatus}
            aria-labelledby={statusLabelId}
            className="w-full"
          >
            {CHECK_IN_STATUSES.map((value) => {
              const Icon = STATUS_ICON[value]
              return (
                <ToggleGroupItem key={value} value={value}>
                  <Icon aria-hidden="true" strokeWidth={1.75} />
                  {vi.block[value]}
                </ToggleGroupItem>
              )
            })}
          </ToggleGroup>
        </div>
        <FormField
          id={`${uid}-minutes`}
          label={copy.minutes}
          description={copy.minutesHelper}
          error={minutesError}
        >
          {(control) => (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                aria-label={copy.fewer}
                disabled={parsedMinutes !== null && parsedMinutes <= SHEET_MINUTES.min}
                onClick={() => step(-SHEET_MINUTES.step)}
              >
                <Minus aria-hidden="true" strokeWidth={1.75} />
              </Button>
              <Input
                {...control}
                type="number"
                inputMode="numeric"
                min={SHEET_MINUTES.min}
                max={SHEET_MINUTES.max}
                step={1}
                value={minutes}
                onChange={(event) => setMinutes(event.target.value)}
                className="max-w-24 text-center"
              />
              <Button
                variant="outline"
                size="icon"
                aria-label={copy.more}
                disabled={parsedMinutes !== null && parsedMinutes >= SHEET_MINUTES.max}
                onClick={() => step(SHEET_MINUTES.step)}
              >
                <Plus aria-hidden="true" strokeWidth={1.75} />
              </Button>
            </div>
          )}
        </FormField>
        <FormField
          id={`${uid}-note`}
          label={copy.note}
          description={fill(copy.noteCount, {
            n: formatNumber(count),
            max: formatNumber(NOTE_MAX_GRAPHEMES),
          })}
          error={noteMessage}
        >
          {(control) => (
            <Textarea
              {...control}
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          )}
        </FormField>
        <p data-slot="check-in-sheet-limits" aria-live="polite" className="sr-only">
          {noteMessage ?? minutesError ?? ''}
        </p>
        <div role="status" aria-live="polite">
          {error !== null && (
            <Banner
              tone="danger"
              action={
                <Button variant="outline" onClick={submit}>
                  <RotateCcw aria-hidden="true" strokeWidth={1.75} />
                  {vi.common.retry}
                </Button>
              }
            >
              {error}
            </Banner>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={close}>
            {vi.common.cancel}
          </Button>
          <Button type="submit" loading={pending} disabled={invalid}>
            {copy.submit}
          </Button>
        </DialogFooter>
      </form>
    </>
  )

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close()
      }}
    >
      {desktop ? (
        <DialogContent onOpenAutoFocus={focusTitle} onCloseAutoFocus={returnFocus}>
          {body}
        </DialogContent>
      ) : (
        <SheetContent side="bottom" onOpenAutoFocus={focusTitle} onCloseAutoFocus={returnFocus}>
          {body}
        </SheetContent>
      )}
    </Dialog>
  )
}

export { CheckInSheet }
export type { CheckInSheetProps }
