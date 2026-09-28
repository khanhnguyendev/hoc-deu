'use client'

import { Copy, KeyRound } from 'lucide-react'
import { useRef, useState, useTransition, type Ref } from 'react'
import { Banner } from '@/components/patterns/banner'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { FormActions } from '@/components/patterns/form-actions'
import { isNavigationError } from '@/components/patterns/navigation-error'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/toaster'
import { fill } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'
import type { BotTokenView } from '../bot'

const copy = vi.adminBot.token

type RotateResult = { ok: true; token: string; message: string } | { ok: false; message: string }

function tokenStatus(token: BotTokenView): string[] {
  if (token.state === 'none') return [copy.none]
  const lines = [
    token.createdAt === null ? copy.exists : fill(copy.current, { time: token.createdAt }),
  ]
  if (token.previousValidUntil !== null) {
    lines.push(fill(copy.previous, { time: token.previousValidUntil }))
  }
  return lines
}

/** The new token, shown once: read-only, selected on focus, with a copy button. */
function NewToken({ token, inputRef }: { token: string; inputRef?: Ref<HTMLInputElement> }) {
  const copyToken = async () => {
    try {
      await navigator.clipboard.writeText(token)
      toast(copy.copied)
    } catch {
      toast(copy.copyFailed)
    }
  }
  return (
    <div data-slot="bot-new-token" className="flex flex-col gap-2">
      <Label htmlFor="bot-new-token">{copy.newToken}</Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          ref={inputRef}
          id="bot-new-token"
          readOnly
          value={token}
          lang="en"
          spellCheck={false}
          autoComplete="off"
          aria-describedby="bot-new-token-once"
          onFocus={(event) => event.currentTarget.select()}
          className="font-mono"
        />
        <Button type="button" variant="outline" onClick={copyToken}>
          <Copy aria-hidden="true" strokeWidth={1.75} />
          {copy.copy}
        </Button>
      </div>
      <Banner tone="warning">
        <span id="bot-new-token-once">
          <strong>{copy.shownOnce}</strong> — {copy.shownOnceHint}
        </span>
      </Banner>
    </div>
  )
}

/**
 * `/admin/bot`'s token (§6.3, ADR-0026): "Chưa có token", or when the current token was made and,
 * during the 24-hour overlap, until when the old one still works. "Tạo token mới" asks first
 * (`ConfirmDialog`), then shows the new token **once** — it lives only in this component's state,
 * never in the page's props or HTML, so a reload shows only the times; once the dialog closes,
 * focus moves to it (a failure returns focus to "Tạo token mới"). The server action comes in as a
 * prop.
 */
function BotToken({
  token,
  rotateBotToken,
}: {
  token: BotTokenView
  rotateBotToken: () => Promise<RotateResult>
}) {
  const [open, setOpen] = useState(false)
  const [shown, setShown] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const tokenField = useRef<HTMLInputElement>(null)
  /** Set by a successful rotation: the dialog's close moves focus to the new token. */
  const focusNewToken = useRef(false)
  // The first token has no old one that keeps working for 24 hours.
  const confirmCopy = token.state === 'none' ? copy.confirmFirst : copy.confirm

  const rotate = () => {
    setError(null)
    startTransition(async () => {
      let result: RotateResult
      try {
        result = await rotateBotToken()
      } catch (caught) {
        if (isNavigationError(caught)) return
        result = { ok: false, message: vi.errors.saveFailed }
      }
      setOpen(false)
      if (result.ok) {
        focusNewToken.current = true
        setShown(result.token)
      } else {
        setError(result.message)
      }
      toast(result.message)
    })
  }

  return (
    <div data-slot="bot-token" className="flex flex-col gap-4">
      <div className="flex items-start gap-2">
        <KeyRound
          aria-hidden="true"
          strokeWidth={1.75}
          className="mt-0.5 size-5 shrink-0 text-muted-foreground"
        />
        <div className="flex flex-col gap-1">
          {tokenStatus(token).map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </div>
      {shown !== null && <NewToken token={shown} inputRef={tokenField} />}
      <FormActions error={error}>
        <Button type="button" variant="outline" onClick={() => setOpen(true)}>
          {copy.rotate}
        </Button>
      </FormActions>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={confirmCopy.title}
        description={confirmCopy.description}
        confirmLabel={copy.rotate}
        pending={pending}
        onConfirm={rotate}
        // A new token: focus goes to its field, not back to the button (WCAG 2.4.3).
        onCloseAutoFocus={(event) => {
          if (!focusNewToken.current || tokenField.current === null) return
          focusNewToken.current = false
          event.preventDefault()
          tokenField.current.focus()
        }}
      />
    </div>
  )
}

export { BotToken }
