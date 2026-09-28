import { Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { vi } from '@/lib/i18n/vi'
import type { AiPlanView } from '../view-model'

const copy = vi.aiPlan

/**
 * The mode badge of an AI plan on `/today` (spec §2.4, Part B-M6 decision 16, ADR-0018): under the
 * page header, a `primary` Badge — the `Sparkles` icon and "Cá nhân hoá bởi AI", never colour
 * alone — and the plan's rationale below it as plain text (cleaned on the server, §6.4.3 rule 6;
 * React escapes it), wrapping anywhere a long word needs. One labelled group, so the badge and the
 * rationale read together. An AI plan without a rationale shows the badge alone; a baseline plan
 * renders no note at all (the view model's `aiPlan` is null — v1.0 unchanged). Server-compatible.
 */
function AiPlanNote({ view }: { view: AiPlanView }) {
  return (
    <div
      data-slot="ai-plan-note"
      role="group"
      aria-label={copy.label}
      className="flex flex-col items-start gap-2"
    >
      <Badge tone="primary">
        <Sparkles aria-hidden="true" strokeWidth={1.75} />
        {copy.badge}
      </Badge>
      {view.rationale !== null && (
        <p className="max-w-prose text-sm break-words text-muted-foreground">{view.rationale}</p>
      )}
    </div>
  )
}

export { AiPlanNote }
