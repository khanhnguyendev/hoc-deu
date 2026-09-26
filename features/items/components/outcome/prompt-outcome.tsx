'use client'

import { CircleCheck } from 'lucide-react'
import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { vi } from '@/lib/i18n/vi'
import type { OutcomeBinding } from '../../outcome'
import { OutcomeMessage } from './grade-buttons'
import { useOutcome } from './use-outcome'

const copy = vi.outcomes.prompt

type Rating = 1 | 2 | 3
const RATINGS: readonly Rating[] = [1, 2, 3]

/**
 * A prompt's result (§4.4): an optional self-rating 1–3 ("Tự đánh giá (không bắt buộc)", a
 * single-choice ToggleGroup — choosing the chosen one again clears it), then "Đã làm xong", the
 * view's one primary action, sending `prompt.completed` with `selfRating` when one is chosen. The
 * answer is announced in a polite live region.
 */
function PromptOutcome({ binding }: { binding: OutcomeBinding }) {
  const [rating, setRating] = useState<Rating | null>(null)
  const { pending, sent, saved, send } = useOutcome<'completed'>(binding)
  const labelId = useId()

  const done = () =>
    send(
      rating === null
        ? { type: 'prompt.completed' }
        : { type: 'prompt.completed', selfRating: rating },
      'completed',
    )

  return (
    <div
      data-slot="prompt-outcome"
      className="flex flex-col items-start gap-4 border-t border-border pt-6"
    >
      <div className="flex flex-col gap-2">
        <p id={labelId} className="font-medium">
          {copy.ratingLabel}
        </p>
        <ToggleGroup
          type="single"
          aria-labelledby={labelId}
          value={rating === null ? '' : String(rating)}
          onValueChange={(value) => setRating(RATINGS.find((r) => String(r) === value) ?? null)}
        >
          {RATINGS.map((value) => (
            <ToggleGroupItem key={value} value={String(value)}>
              {copy.ratings[value]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <Button size="lg" loading={pending !== null} onClick={done}>
        {saved !== null && <CircleCheck aria-hidden="true" strokeWidth={1.75} />}
        {copy.done}
      </Button>
      <OutcomeMessage result={sent} />
    </div>
  )
}

export { PromptOutcome }
