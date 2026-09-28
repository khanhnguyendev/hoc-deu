import { CircleCheck, CircleX, Clock, Send, type LucideIcon } from 'lucide-react'
import Link from 'next/link'
import {
  DataTable,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
  DataTableRowHeader,
} from '@/components/patterns/data-table'
import { EmptyState } from '@/components/patterns/empty-state'
import { ErrorState } from '@/components/patterns/error-state'
import { Button } from '@/components/ui/button'
import { vi } from '@/lib/i18n/vi'
import type { PublishRequestView, PublishRequestsView } from '../content'

const copy = vi.publish.requests

/** A status always shows its icon with its words (never colour alone). */
const STATUS_ICONS: Readonly<Record<PublishRequestView['status'], LucideIcon>> = {
  pending: Clock,
  merged: CircleCheck,
  cancelled: CircleX,
}

function Target({ row }: { row: PublishRequestView }) {
  const name = (
    <span lang={row.titleLang} className="font-medium">
      {row.title}
    </span>
  )
  return (
    <span className="flex flex-col">
      {row.href === null ? (
        name
      ) : (
        <Button asChild variant="link" size="sm">
          <Link href={row.href}>{name}</Link>
        </Button>
      )}
      <span className="text-xs font-normal text-muted-foreground">
        {row.kind === null ? null : <>{row.kind} · </>}
        <code className="font-mono">{row.target}</code>
      </span>
    </span>
  )
}

/**
 * The "Yêu cầu xuất bản" section of `/admin/content` (§2.4, §6.6; task 6.7a): pending requests
 * first, then the latest merged or cancelled ones, newest first — the item (a link to its page,
 * with its target), the status with its icon, the publish run's PR once set, and when it was
 * requested (Asia/Ho_Chi_Minh). Empty: "Chưa có yêu cầu xuất bản nào"; the requests could not be
 * read: an error state (the drafts above stay usable).
 */
function PublishRequests({ requests }: { requests: PublishRequestsView }) {
  if (requests.state === 'empty') {
    return (
      <EmptyState
        icon={Send}
        title={copy.empty.title}
        description={copy.empty.description}
        titleAs="h3"
      />
    )
  }
  if (requests.state === 'error') {
    return <ErrorState title={copy.error.title} description={copy.error.description} titleAs="h3" />
  }
  return (
    <div data-slot="publish-requests">
      <DataTable label={copy.label}>
        <DataTableHead>
          <DataTableHeader>{copy.columns.target}</DataTableHeader>
          <DataTableHeader>{copy.columns.status}</DataTableHeader>
          <DataTableHeader>{copy.columns.pr}</DataTableHeader>
          <DataTableHeader>{copy.columns.requestedAt}</DataTableHeader>
        </DataTableHead>
        <tbody>
          {requests.rows.map((row) => {
            const Icon = STATUS_ICONS[row.status]
            return (
              <DataTableRow key={row.id} data-request={row.id}>
                <DataTableRowHeader>
                  <Target row={row} />
                </DataTableRowHeader>
                <DataTableCell>
                  <span
                    data-status={row.status}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Icon aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0" />
                    {row.statusLabel}
                  </span>
                </DataTableCell>
                <DataTableCell>
                  {row.pr === null ? (
                    copy.none
                  ) : (
                    <Button asChild variant="link">
                      <a href={row.pr.href} target="_blank" rel="noopener noreferrer">
                        {row.pr.label} <span className="sr-only">{vi.content.newTab}</span>
                      </a>
                    </Button>
                  )}
                </DataTableCell>
                <DataTableCell>{row.requestedAt}</DataTableCell>
              </DataTableRow>
            )
          })}
        </tbody>
      </DataTable>
    </div>
  )
}

export { PublishRequests }
