import { Bot, CircleAlert, CircleCheck, Clock, type LucideIcon } from 'lucide-react'
import {
  DataTable,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
  DataTableRowHeader,
} from '@/components/patterns/data-table'
import { Banner } from '@/components/patterns/banner'
import { EmptyState } from '@/components/patterns/empty-state'
import { ErrorState } from '@/components/patterns/error-state'
import { Button } from '@/components/ui/button'
import { fill, formatNumber } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'
import type { BotRunCounts, BotRunLogView, BotRunRow } from '../bot'

const copy = vi.adminBot.runLog

/** The count columns, in order (their headers are `copy.columns[key]`). */
const COUNT_COLUMNS: readonly (keyof BotRunCounts)[] = [
  'eligible',
  'pending',
  'applied',
  'dryRun',
  'skipped',
  'invalid',
  'error',
  'deferred',
]

/** A status always shows its icon with its words (never colour alone). */
const STATUS_ICONS: Readonly<Record<BotRunRow['status'], LucideIcon>> = {
  running: Clock,
  completed: CircleCheck,
  failed: CircleAlert,
}

function Status({ row }: { row: BotRunRow }) {
  const Icon = STATUS_ICONS[row.status]
  return (
    <span data-status={row.status} className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <Icon aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0" />
      {row.statusLabel}
    </span>
  )
}

/** The content PR on GitHub, in a new tab (said so, for screen readers). */
function PullRequest({ pr }: { pr: BotRunRow['pr'] }) {
  if (pr === null) return copy.none
  return (
    <Button asChild variant="link">
      <a href={pr.href} target="_blank" rel="noopener noreferrer">
        {pr.label} <span className="sr-only">{vi.content.newTab}</span>
      </a>
    </Button>
  )
}

function RunTable({ rows }: { rows: readonly BotRunRow[] }) {
  return (
    <DataTable label={copy.label}>
      <DataTableHead>
        <DataTableHeader>{copy.columns.run}</DataTableHeader>
        <DataTableHeader>{copy.columns.kind}</DataTableHeader>
        <DataTableHeader>{copy.columns.mode}</DataTableHeader>
        <DataTableHeader>{copy.columns.status}</DataTableHeader>
        {COUNT_COLUMNS.map((column) => (
          <DataTableHeader key={column}>{copy.columns[column]}</DataTableHeader>
        ))}
        <DataTableHeader>{copy.columns.pr}</DataTableHeader>
        <DataTableHeader>{copy.columns.summary}</DataTableHeader>
      </DataTableHead>
      <tbody>
        {rows.map((row) => (
          <DataTableRow key={row.key} data-run={row.key}>
            <DataTableRowHeader>
              <span className="flex flex-col">
                <span>{row.day}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {fill(copy.startedAt, { time: row.startedAt })}
                </span>
              </span>
            </DataTableRowHeader>
            <DataTableCell>{row.kind}</DataTableCell>
            <DataTableCell>{row.modeLabel}</DataTableCell>
            <DataTableCell>
              <Status row={row} />
            </DataTableCell>
            {COUNT_COLUMNS.map((column) => (
              <DataTableCell key={column} numeric>
                {formatNumber(row.counts[column])}
              </DataTableCell>
            ))}
            <DataTableCell>
              <PullRequest pr={row.pr} />
            </DataTableCell>
            <DataTableCell>{row.summary ?? copy.none}</DataTableCell>
          </DataTableRow>
        ))}
      </tbody>
    </DataTable>
  )
}

/**
 * `/admin/bot`'s run log (§2.4, §6.2; task 6.4a): the latest runs of `admin_bot_runs(20)`, newest
 * first — date and start time (Asia/Ho_Chi_Minh), kind, mode, status with a failure's reason, the
 * user counts per outcome and the deferred count, the content PR link and the bot's summary
 * (counts only). Counts only: no learner is named. The deferred-users warning (today's plan run
 * left users out) sits above it. Empty: "Chưa có lần chạy nào"; the runs could not be read: an
 * error state (the controls above stay usable).
 */
function BotRunLog({
  log,
  deferredWarning = null,
}: {
  log: BotRunLogView
  deferredWarning?: string | null
}) {
  return (
    <div data-slot="bot-run-log" className="flex flex-col gap-3">
      {deferredWarning !== null && <Banner tone="warning">{deferredWarning}</Banner>}
      {log.state === 'ready' && <RunTable rows={log.rows} />}
      {log.state === 'empty' && (
        <EmptyState
          icon={Bot}
          title={copy.empty.title}
          description={copy.empty.description}
          titleAs="h3"
        />
      )}
      {log.state === 'error' && (
        <ErrorState title={copy.error.title} description={copy.error.description} titleAs="h3" />
      )}
    </div>
  )
}

export { BotRunLog }
