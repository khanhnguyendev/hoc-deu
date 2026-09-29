import { Clock } from 'lucide-react'
import { useId } from 'react'
import type * as React from 'react'
import { StatusPill } from '@/components/patterns/status-pill'
import { Badge } from '@/components/ui/badge'
import type { HeatLevel } from '@/components/patterns/calendar-heatmap/levels'
import { vi } from '@/lib/i18n/vi'
import { HeatCell } from './heat-cell'

const copy = vi.landing.preview

/** Mon–Sun of the example week: two studied days, today (T4), then days not yet come. */
const STRIP: readonly HeatLevel[] = [2, 3, 3, 0, 0, 0, 0]
const TODAY = 2

function Minutes({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <Clock aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0" />
      <span>
        <span className="font-mono">{value}</span> {copy.minutesUnit}
      </span>
    </span>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <li className="flex items-baseline gap-3 text-base">
      <span className="w-16 shrink-0 text-sm text-muted-foreground">{label}</span>
      <span className="min-w-0">{children}</span>
    </li>
  )
}

/** A block in the grammar of `PlanBlockCard`: track stripe, kind, track chip, minutes, item rows. */
function PreviewBlock({
  accent,
  kind,
  track,
  minutes,
  children,
  footer,
}: {
  accent: 'track-1' | 'track-2'
  kind: string
  track: string
  minutes: number
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <div
      data-accent={accent}
      data-slot="preview-block"
      className="flex overflow-hidden rounded-lg border border-border bg-surface"
    >
      <span aria-hidden="true" className="w-1 shrink-0 bg-track" />
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <p className="text-lg font-semibold">{kind}</p> <Badge tone="track">{track}</Badge>
          </div>
          <Minutes value={minutes} />
        </div>
        <ul className="flex flex-col gap-2">{children}</ul>
        {footer}
      </div>
    </div>
  )
}

/**
 * The example day beside the landing headline (DESIGN_SYSTEM §15): a non-interactive figure —
 * plain text rows, no links, no buttons. One block is checked in; a 7-day strip closes it. The
 * decorative cells are `aria-hidden`, the meaning is in the visible caption and a screen-reader
 * summary. Motion: the pill settles in and today's cell deepens one level (CSS only).
 */
function TodayPreview() {
  const blocks = copy.blocks
  const captionId = useId()
  return (
    <figure data-slot="today-preview" aria-labelledby={captionId} className="flex flex-col gap-3">
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface-sunken p-3 md:p-4">
        <div className="flex items-baseline justify-between gap-3 px-1">
          <p className="text-lg font-semibold">{copy.date}</p>
          <p className="text-base text-muted-foreground">
            <span className="font-mono">{copy.totalMinutes}</span> {copy.minutesUnit}
          </p>
        </div>
        <PreviewBlock
          accent="track-1"
          kind={blocks.newLesson.kind}
          track={copy.dsa}
          minutes={blocks.newLesson.minutes}
          footer={
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex landing-settle">
                <StatusPill status="block-done" />
              </span>
              <span className="text-sm text-muted-foreground">
                <span className="font-mono">{blocks.newLesson.minutes}</span> {copy.minutesUnit}
              </span>
            </div>
          }
        >
          <Row label={copy.itemLabels.lesson}>
            <span lang="en">Two Pointers</span>
          </Row>
          <Row label={copy.itemLabels.problem}>
            <span lang="en">Valid Palindrome</span>
          </Row>
        </PreviewBlock>
        <PreviewBlock
          accent="track-1"
          kind={blocks.review.kind}
          track={copy.dsa}
          minutes={blocks.review.minutes}
        >
          <Row label={copy.itemLabels.review}>
            <span lang="en">Two Sum</span>
          </Row>
        </PreviewBlock>
        <PreviewBlock
          accent="track-2"
          kind={blocks.cards.kind}
          track={copy.english}
          minutes={blocks.cards.minutes}
        >
          <Row label={copy.itemLabels.cards}>
            {copy.cardsCount} <span lang="en">{copy.cardsDeck}</span>
          </Row>
        </PreviewBlock>
        <div className="flex flex-col gap-2 px-1">
          <p className="text-sm text-muted-foreground">{copy.heatLabel}</p>
          <div aria-hidden="true" className="grid grid-cols-7 gap-1.5">
            {STRIP.map((level, day) => (
              <HeatCell
                key={vi.heatmap.weekdays[day]}
                size="strip"
                level={day === TODAY ? 2 : level}
                deepenTo={day === TODAY ? 3 : undefined}
                today={day === TODAY}
              />
            ))}
          </div>
          <div
            aria-hidden="true"
            className="grid grid-cols-7 gap-1.5 text-xs text-muted-foreground"
          >
            {vi.heatmap.weekdays.map((day) => (
              <span key={day} className="text-center">
                {day}
              </span>
            ))}
          </div>
          <p className="sr-only">{copy.heatSummary}</p>
        </div>
      </div>
      <figcaption id={captionId} className="text-sm text-muted-foreground">
        {copy.caption}
      </figcaption>
    </figure>
  )
}

export { TodayPreview }
