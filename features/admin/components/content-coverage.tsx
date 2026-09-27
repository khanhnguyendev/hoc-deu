import { CircleAlert, CircleCheck, CircleDashed, type LucideIcon } from 'lucide-react'
import type * as React from 'react'
import {
  DataTable,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
  DataTableRowHeader,
} from '@/components/patterns/data-table'
import { fill, formatNumber } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'
import { cn } from '@/lib/utils'
import type { CoverageColumn, CoverageRow, CoverageState, RoadmapCoverage } from '../content'

const copy = vi.adminOverview.content.coverage

/** Column headers; `Exercise` and `Prompt` are English item-type names. */
const COLUMNS: Readonly<
  Record<
    CoverageColumn,
    { label: string; lang?: 'en'; cell: (row: CoverageRow) => React.ReactNode }
  >
> = {
  lessons: { label: copy.lessons, cell: (row) => <Lessons row={row} /> },
  notes: {
    label: copy.notes,
    cell: (row) => `${formatNumber(row.notedProblems)}/${formatNumber(row.placedProblems)}`,
  },
  cards: {
    label: copy.cards,
    cell: (row) => `${formatNumber(row.coreCards)} + ${formatNumber(row.extendedCards)}`,
  },
  exercises: { label: copy.exercises, lang: 'en', cell: (row) => formatNumber(row.exercises) },
  prompts: { label: copy.prompts, lang: 'en', cell: (row) => formatNumber(row.prompts) },
}

/** The notes and counts are numbers; the lessons cell is text. */
const isNumeric = (column: CoverageColumn) => column !== 'lessons'

/** Each week topic by title; a topic without its pattern lesson says "(thiếu)" — text, not colour. */
function Lessons({ row }: { row: CoverageRow }) {
  if (row.lessons.length === 0) return copy.noTopics
  return (
    <ul className="flex flex-col gap-0.5">
      {row.lessons.map((lesson) => (
        <li key={lesson.topic} className={cn(!lesson.present && 'font-medium')}>
          {lesson.title}
          {!lesson.present && ` ${copy.missing}`}
        </li>
      ))}
    </ul>
  )
}

const STATES: Readonly<
  Record<CoverageState, { icon: LucideIcon; label: string; className: string }>
> = {
  red: { icon: CircleAlert, label: copy.red, className: 'font-semibold' },
  gap: { icon: CircleDashed, label: copy.gap, className: 'text-muted-foreground' },
  covered: { icon: CircleCheck, label: copy.covered, className: '' },
}

function StateLabel({ state }: { state: CoverageState }) {
  const { icon: Icon, label, className } = STATES[state]
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap', className)}>
      <Icon aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0" />
      {label}
    </span>
  )
}

/**
 * One roadmap variant's coverage by week on `/admin/content` (§0, §2.4; decision 25): per week
 * its learners now, the columns of the item types the track lists (topic lessons, noted / placed
 * problems, core + extended cards, exercises, prompts) and its state. A week an active learner
 * reaches within 14 days (up to the highest learner week + 2) with a missing pattern lesson or an
 * unnoted placed problem is red: `danger-soft`, an icon and "Cần bổ sung". A gap further ahead
 * reads "Còn thiếu". Above the table one line names the horizon, or says no learner has a recent
 * plan; a variant without its roadmap file says so instead of a table.
 */
function ContentCoverage({ coverage }: { coverage: RoadmapCoverage }) {
  return (
    <div data-slot="content-coverage" className="flex flex-col gap-3">
      <h3 className="text-lg font-semibold">
        {fill(copy.title, { variant: coverage.variantLabel })}
      </h3>
      {coverage.rows === null ? (
        <p className="text-sm text-muted-foreground">{copy.missingRoadmap}</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {coverage.horizon === null || coverage.maxLearnerWeek === null
              ? copy.noLearners
              : fill(copy.horizon, {
                  week: formatNumber(coverage.maxLearnerWeek),
                  horizon: formatNumber(coverage.horizon),
                })}
          </p>
          <DataTable
            label={fill(copy.label, {
              track: coverage.trackTitle,
              variant: coverage.variantLabel,
            })}
          >
            <DataTableHead>
              <DataTableHeader>{copy.week}</DataTableHeader>
              <DataTableHeader>{copy.learners}</DataTableHeader>
              {coverage.columns.map((column) => (
                <DataTableHeader key={column} lang={COLUMNS[column].lang}>
                  {COLUMNS[column].label}
                </DataTableHeader>
              ))}
              <DataTableHeader>{copy.state}</DataTableHeader>
            </DataTableHead>
            <tbody>
              {coverage.rows.map((row) => (
                <DataTableRow
                  key={row.week}
                  data-state={row.state}
                  tone={row.state === 'red' ? 'danger' : 'default'}
                >
                  <DataTableRowHeader numeric>{formatNumber(row.week)}</DataTableRowHeader>
                  <DataTableCell numeric>{formatNumber(row.learners)}</DataTableCell>
                  {coverage.columns.map((column) => (
                    <DataTableCell key={column} numeric={isNumeric(column)}>
                      {COLUMNS[column].cell(row)}
                    </DataTableCell>
                  ))}
                  <DataTableCell>
                    <StateLabel state={row.state} />
                  </DataTableCell>
                </DataTableRow>
              ))}
            </tbody>
          </DataTable>
        </>
      )}
    </div>
  )
}

export { ContentCoverage }
