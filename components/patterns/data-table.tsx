import { cva } from 'class-variance-authority'
import type * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * A data table (parked #1: the admin tables' classes, once a module of `features/admin`): one
 * focusable, labelled horizontal scroll region per table — keyboard users can scroll it — with
 * header and body cells, numbers in mono with tabular figures (DESIGN_SYSTEM §9). Compose:
 * `DataTable` › `DataTableHead` (its `DataTableHeader`s) and `tbody` › `DataTableRow` (a
 * `DataTableRowHeader`, then `DataTableCell`s).
 */
function DataTable({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      data-slot="data-table"
      role="region"
      tabIndex={0}
      aria-label={label}
      className="overflow-x-auto rounded-lg border border-border bg-surface"
    >
      <table className="w-full border-collapse text-left text-sm">{children}</table>
    </div>
  )
}

/** The column headers' row. */
function DataTableHead({ children }: { children: React.ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-border-strong">{children}</tr>
    </thead>
  )
}

const cellVariants = cva('px-3 py-2', {
  variants: {
    kind: {
      header: 'font-semibold whitespace-nowrap',
      rowHeader: 'text-left font-medium whitespace-nowrap',
      cell: 'align-top',
    },
    /** A number: mono, tabular figures, never wrapped. */
    numeric: { true: 'font-mono whitespace-nowrap tabular-nums', false: '' },
  },
  defaultVariants: { kind: 'cell', numeric: false },
})

type CellProps = { numeric?: boolean; lang?: string; children?: React.ReactNode }

/** A column header (`scope="col"`); `lang="en"` for an English item-type name. */
function DataTableHeader({ lang, children }: Omit<CellProps, 'numeric'>) {
  return (
    <th scope="col" lang={lang} className={cn(cellVariants({ kind: 'header' }))}>
      {children}
    </th>
  )
}

/** A row's header cell (`scope="row"`): what the row is about. */
function DataTableRowHeader({ numeric = false, lang, children }: CellProps) {
  return (
    <th scope="row" lang={lang} className={cn(cellVariants({ kind: 'rowHeader', numeric }))}>
      {children}
    </th>
  )
}

/** A body cell; `numeric` for a number. */
function DataTableCell({ numeric = false, children }: Omit<CellProps, 'lang'>) {
  return <td className={cn(cellVariants({ kind: 'cell', numeric }))}>{children}</td>
}

const rowVariants = cva('border-b border-border last:border-b-0', {
  variants: {
    tone: {
      default: '',
      /** A row that needs action (a red coverage week): never colour alone — a cell says so. */
      danger: 'bg-danger-soft text-danger-soft-foreground',
    },
  },
  defaultVariants: { tone: 'default' },
})

/** A body row. */
function DataTableRow({
  tone = 'default',
  children,
  ...props
}: Omit<React.ComponentProps<'tr'>, 'className'> & { tone?: 'default' | 'danger' }) {
  return (
    <tr {...props} className={cn(rowVariants({ tone }))}>
      {children}
    </tr>
  )
}

export {
  DataTable,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
  DataTableRowHeader,
}
