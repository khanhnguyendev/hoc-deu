'use client'

import { cva } from 'class-variance-authority'
import { CircleAlert, CircleCheck } from 'lucide-react'
import { useId } from 'react'
import { Button } from '@/components/ui/button'

export type GradeOption<G extends string> = {
  readonly value: G
  readonly label: string
  /** A keyboard shortcut the caller handles (FlashcardGrades: 1 / 2 / 3), shown as a key cap. */
  readonly shortcut?: string
}

/**
 * Self-reported grades (§5.5, DESIGN_SYSTEM §9): a named group of 44 px buttons, one per grade.
 * A press sends that grade at once (`onGrade`); the chosen grade — the saved one, or the one the
 * page preselects (the solution-reveal nudge, decision 18) — is pressed (`aria-pressed`) and the
 * one primary of the group, and any other grade can still be chosen. While a grade saves it shows
 * busy and the others are disabled. `description` (a nudge, the key hints) describes the group.
 */
function GradeButtons<G extends string>({
  label,
  grades,
  selected = null,
  pending = null,
  disabled = false,
  description,
  onGrade,
}: {
  label: string
  grades: readonly GradeOption<G>[]
  selected?: G | null
  pending?: G | null
  disabled?: boolean
  description?: string
  onGrade: (grade: G) => void
}) {
  const labelId = useId()
  const descriptionId = useId()
  return (
    <div
      data-slot="grade-buttons"
      role="group"
      aria-labelledby={labelId}
      aria-describedby={description === undefined ? undefined : descriptionId}
      className="flex flex-col gap-2"
    >
      <p id={labelId} className="font-medium">
        {label}
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        {grades.map((grade) => {
          const chosen = selected === grade.value
          return (
            <Button
              key={grade.value}
              variant={chosen ? 'primary' : 'outline'}
              aria-pressed={chosen}
              aria-keyshortcuts={grade.shortcut}
              loading={pending === grade.value}
              disabled={disabled || (pending !== null && pending !== grade.value)}
              onClick={() => onGrade(grade.value)}
            >
              {grade.label}
              {grade.shortcut !== undefined && (
                <kbd
                  aria-hidden="true"
                  className="hidden rounded-sm border border-current px-1.5 font-mono text-xs md:inline"
                >
                  {grade.shortcut}
                </kbd>
              )}
            </Button>
          )
        })}
      </div>
      {description !== undefined && (
        <p id={descriptionId} className="text-sm text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  )
}

const messageVariants = cva('flex min-h-6 items-start gap-2 text-sm font-medium', {
  variants: {
    tone: { idle: '', saved: 'text-success', failed: 'text-danger' },
  },
})

/**
 * The polite live region beside a page's result controls: empty until an answer, then the
 * server's message ("Đã lưu kết quả.", "… tự động check-in.") or why it was not saved — an icon and
 * text, never colour alone. Always rendered, so screen readers announce the change.
 */
function OutcomeMessage({
  result,
}: {
  result: { readonly ok: boolean; readonly message: string } | null
}) {
  const tone = result === null ? 'idle' : result.ok ? 'saved' : 'failed'
  const Icon = result === null ? null : result.ok ? CircleCheck : CircleAlert
  return (
    <p
      role="status"
      aria-live="polite"
      data-slot="outcome-message"
      data-tone={tone}
      className={messageVariants({ tone })}
    >
      {Icon !== null && (
        <Icon aria-hidden="true" strokeWidth={1.75} className="mt-0.5 size-4 shrink-0" />
      )}
      {result?.message}
    </p>
  )
}

export { GradeButtons, OutcomeMessage }
