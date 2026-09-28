import { Bot, CircleCheck, FileCheck, Info, type LucideIcon } from 'lucide-react'
import type * as React from 'react'
import { EmptyState } from '@/components/patterns/empty-state'
import { LinkList } from '@/components/patterns/link-list'
import { LinkRow } from '@/components/patterns/link-row'
import { Badge } from '@/components/ui/badge'
import { formatNumber } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'
import type { AdminActionResult } from '../actions'
import type { DraftEntry, Drafts, DraftVerification } from '../content'
import { PublishButton } from './publish-button'

const copy = vi.adminOverview.content.drafts

/**
 * A draft note's verification (§3.5, §3.7): "Đã kiểm thử", "Chỉ biên dịch", or — for a note the
 * bot wrote, solution and tests alike — "Đã kiểm thử (test do bot viết)" until an admin publishes
 * it with the checklist (ADR-0040). Only admins see drafts, so only this list shows that variant.
 */
const VERIFICATION: Readonly<
  Record<
    DraftVerification,
    { label: string; icon: LucideIcon; tone: 'success' | 'neutral' | 'warning' }
  >
> = {
  tested: { label: vi.items.verification.tested, icon: CircleCheck, tone: 'success' },
  'compile-only': { label: vi.items.verification.compileOnly, icon: Info, tone: 'neutral' },
  'tested-by-bot': { label: vi.publish.badge.testedByBot, icon: Bot, tone: 'warning' },
}

function DraftVerificationBadge({ verification }: { verification: DraftVerification }) {
  const { label, icon: Icon, tone } = VERIFICATION[verification]
  return (
    <Badge tone={tone} data-slot="draft-verification" data-verification={verification}>
      <Icon aria-hidden="true" strokeWidth={1.75} />
      {label}
    </Badge>
  )
}

type PublishActions = {
  requestPublish?: ((target: string) => Promise<AdminActionResult>) | undefined
  cancelPublish?: ((requestId: number) => Promise<AdminActionResult>) | undefined
}

/** The copy's `code` spans (between backticks) as `<code>`. */
function withCode(text: string): React.ReactNode[] {
  return text.split('`').map((part, index) =>
    index % 2 === 1 ? (
      <code key={index} className="font-mono text-sm">
        {part}
      </code>
    ) : (
      part
    ),
  )
}

type Group = { key: string; title: string; rows: readonly DraftEntry[] }

/**
 * What is still a draft on `/admin/content` (§2.4, §3.3): draft tracks, draft items and draft
 * notes (a note is its own publish target), each group with its count and a LinkRow per entry to
 * its page — admins see drafts. One line says how v1.0 publishes: a `status` change in
 * `content/**`. v1.1 (task 6.7a, §6.6): beside each draft item and note — never inside its link —
 * "Xuất bản" (`PublishButton`) or its pending request; a draft note shows its verification badge.
 * Without the actions (the component catalog) the pending state still shows. Nothing in draft: an
 * EmptyState.
 */
function DraftsList({
  drafts,
  requestPublish,
  cancelPublish,
}: { drafts: Drafts } & PublishActions) {
  const groups: Group[] = [
    {
      key: 'tracks',
      title: copy.tracks,
      rows: drafts.tracks.map((track) => ({ ...track, titleLang: undefined, meta: [] })),
    },
    { key: 'items', title: copy.items, rows: drafts.items },
    { key: 'notes', title: copy.notes, rows: drafts.notes },
  ].filter((group) => group.rows.length > 0)

  return (
    <div data-slot="drafts-list" className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">{withCode(copy.description)}</p>
      {groups.length === 0 ? (
        <EmptyState icon={FileCheck} title={copy.empty} titleAs="h3" />
      ) : (
        groups.map((group) => (
          <div key={group.key} className="flex flex-col gap-3">
            <h3 className="text-lg font-semibold">
              {group.title} ({formatNumber(group.rows.length)})
            </h3>
            <LinkList>
              {group.rows.map((row) => (
                <li key={row.id} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <LinkRow
                      href={row.href}
                      title={row.title}
                      titleLang={row.titleLang}
                      meta={[...row.meta]}
                      badges={
                        row.verification ? (
                          <DraftVerificationBadge verification={row.verification} />
                        ) : undefined
                      }
                    />
                  </div>
                  {row.target !== undefined && (
                    <div className="px-3 sm:px-0">
                      <PublishButton
                        target={row.target}
                        title={row.title}
                        titleLang={row.titleLang}
                        checklist={row.checklist ?? 'item'}
                        request={row.request ?? null}
                        requestPublish={requestPublish}
                        cancelPublish={cancelPublish}
                      />
                    </div>
                  )}
                </li>
              ))}
            </LinkList>
          </div>
        ))
      )}
    </div>
  )
}

export { DraftsList }
