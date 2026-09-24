import type * as React from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import type { TemplateDay } from '@/lib/content/weekly-template'
import { vi } from '@/lib/i18n/vi'

type WeeklyTemplatePreviewProps = {
  /** The track's Vietnamese title (the card's h3). */
  title: string
  /** `track-1`…`track-8`: the stripe colour (DESIGN_SYSTEM §3.2). */
  accent: string
  /** `describeWeeklyTemplate(manifest.weeklyTemplate)`. */
  days: TemplateDay[]
  /** `describeThrottle(manifest.defaults)`; the section is left out when it is empty. */
  throttle: string[]
}

/**
 * A track's week, read-only (platform design §3.4): each day with its blocks, then the new-item
 * throttle when the track has one. Server-compatible (no hooks), so onboarding and settings can
 * render it on either side.
 */
function WeeklyTemplatePreview({
  title,
  accent,
  days,
  throttle,
}: WeeklyTemplatePreviewProps): React.JSX.Element {
  return (
    <Card
      data-slot="weekly-template-preview"
      data-accent={accent}
      className="border-l-4 border-l-track"
    >
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <dl className="flex flex-col gap-3">
        {days.map((day) => (
          <div key={day.label} className="flex flex-col gap-1 md:flex-row md:gap-4">
            <dt className="font-medium md:w-32 md:shrink-0">{day.label}</dt>
            <dd>
              <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
                {day.blocks.map((block, index) => (
                  <li key={index}>{block}</li>
                ))}
              </ul>
            </dd>
          </div>
        ))}
      </dl>
      {throttle.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-border pt-3">
          <p className="text-sm font-medium">{vi.tracks.throttleTitle}</p>
          <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
            {throttle.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}

export { WeeklyTemplatePreview }
export type { WeeklyTemplatePreviewProps }
