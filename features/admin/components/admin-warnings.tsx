import { CircleCheck } from 'lucide-react'
import Link from 'next/link'
import { Banner } from '@/components/patterns/banner'
import { Section } from '@/components/patterns/section'
import { Button } from '@/components/ui/button'
import { vi } from '@/lib/i18n/vi'
import type { AdminWarning } from '../overview'

const copy = vi.adminOverview.warnings

/** The warning's one action: an admin page, or a GitHub page in a new tab (said so, for screen readers). */
function WarningAction({ action }: { action: AdminWarning['action'] }) {
  const external = action.href.startsWith('https://')
  return (
    <Button asChild variant="outline">
      {external ? (
        <a href={action.href} target="_blank" rel="noopener noreferrer">
          {action.label} <span className="sr-only">{vi.content.newTab}</span>
        </a>
      ) : (
        <Link href={action.href}>{action.label}</Link>
      )}
    </Button>
  )
}

/**
 * The `/admin` warnings, first on the page (§2.4, §8.4 item 5; decisions 25, 26): a Banner each —
 * `danger` (danger-soft) for the red content-coverage warning and a critical DB size, `warning`
 * (warning-soft) for the rest — with its icon, one sentence and one action, red and critical
 * first. None: one line says so, with a check icon (never colour alone).
 */
function AdminWarnings({ warnings }: { warnings: readonly AdminWarning[] }) {
  return (
    <Section title={copy.title}>
      {warnings.length === 0 ? (
        <p data-slot="admin-warnings-none" className="flex items-center gap-2 text-sm">
          <CircleCheck
            aria-hidden="true"
            strokeWidth={1.75}
            className="size-4 shrink-0 text-success"
          />
          {copy.none}
        </p>
      ) : (
        <ul role="list" data-slot="admin-warnings" className="flex flex-col gap-3">
          {warnings.map((warning) => (
            <li key={warning.key} data-kind={warning.kind}>
              <Banner tone={warning.tone} action={<WarningAction action={warning.action} />}>
                {warning.message}
              </Banner>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

export { AdminWarnings }
