import { FileCheck } from 'lucide-react'
import type * as React from 'react'
import { EmptyState } from '@/components/patterns/empty-state'
import { LinkRow } from '@/components/patterns/link-row'
import { formatNumber } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'
import type { DraftEntry, Drafts } from '../content'

const copy = vi.adminOverview.content.drafts

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
 * `content/**`; the "Xuất bản" button is v1.1 (§6.6). Nothing in draft: an EmptyState.
 */
function DraftsList({ drafts }: { drafts: Drafts }) {
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
            <ul
              role="list"
              className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-2"
            >
              {group.rows.map((row) => (
                <li key={row.id}>
                  <LinkRow
                    href={row.href}
                    title={row.title}
                    titleLang={row.titleLang}
                    meta={[...row.meta]}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  )
}

export { DraftsList }
