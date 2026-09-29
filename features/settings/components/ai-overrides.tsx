import { PauseCircle } from 'lucide-react'
import { DataList } from '@/components/patterns/data-list'
import { ErrorState } from '@/components/patterns/error-state'
import { Section } from '@/components/patterns/section'
import { Badge } from '@/components/ui/badge'
import { vi } from '@/lib/i18n/vi'
import { RevokeOverrideButton, type RevokeAiOverrideAction } from './revoke-override-button'

const copy = vi.overrides

/** One override as the list shows it (built on the server: `readAiOverrides`). */
export type AiOverrideView = {
  readonly trackId: string
  readonly key: string
  readonly trackTitle: string
  /** The one-line Vietnamese description by kind. */
  readonly text: string
  /** Kept while the AI flag is off (§5.12): listed, not applied. */
  readonly suspended: boolean
}

type AiOverridesProps = {
  /** The learner's overrides in force (active or suspended); null when they could not be read. */
  overrides: readonly AiOverrideView[] | null
  /** The page's per-render UUID (decision 9). */
  requestId: string
  revokeAiOverride: RevokeAiOverrideAction
}

/**
 * "Điều chỉnh lộ trình bởi AI" (§2.4 `/settings`, §5.12 "Learner control"; task 6.6c): shown only
 * when the learner has an override in force, whatever the AI flag — a suspended one is listed with
 * "Tạm dừng (đã tắt cá nhân hoá AI)" (a badge with an icon, never colour alone). Per override its
 * track, its one-line description and "Thu hồi" (`RevokeOverrideButton`: takes effect from the
 * next plan, §5.9). Without any, it renders nothing; when the list could not be read, the section
 * shows the error state.
 */
function AiOverrides({ overrides, requestId, revokeAiOverride }: AiOverridesProps) {
  if (overrides !== null && overrides.length === 0) return null
  return (
    <Section title={copy.title} description={copy.description}>
      {overrides === null ? (
        <ErrorState title={copy.error} description={vi.states.errorBody} titleAs="h3" />
      ) : (
        <DataList
          items={overrides}
          label={copy.title}
          getKey={(o) => `${o.trackId}:${o.key}`}
          empty={null}
          renderItem={(o) => (
            <div data-slot="ai-override" className="flex w-full flex-wrap items-center gap-3">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-sm text-muted-foreground">{o.trackTitle}</span>
                <span className="font-medium">{o.text}</span>
                {o.suspended && (
                  <Badge tone="warning">
                    <PauseCircle aria-hidden="true" strokeWidth={1.75} />
                    {copy.suspended}
                  </Badge>
                )}
              </div>
              <RevokeOverrideButton
                action={revokeAiOverride}
                requestId={requestId}
                trackId={o.trackId}
                overrideKey={o.key}
                title={o.text}
                trackTitle={o.trackTitle}
              />
            </div>
          )}
        />
      )}
    </Section>
  )
}

export { AiOverrides }
export type { AiOverridesProps }
