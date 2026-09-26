import { cva } from 'class-variance-authority'

/**
 * The admin tables' classes (CatalogStats, ContentCoverage): one focusable, labelled horizontal
 * scroll region per table (keyboard users can scroll it), header and body cells, numbers in mono
 * with tabular figures (DESIGN_SYSTEM §9). A plain module: both components share it.
 */
export const TABLE_REGION = 'overflow-x-auto rounded-lg border border-border bg-surface'
export const TABLE = 'w-full border-collapse text-left text-sm'
export const HEAD_ROW = 'border-b border-border-strong'
export const HEADER_CELL = 'px-3 py-2 font-semibold whitespace-nowrap'
export const ROW_HEADER_CELL = 'px-3 py-2 text-left font-medium whitespace-nowrap'
export const CELL = 'px-3 py-2 align-top'
export const NUMBER_CELL = 'px-3 py-2 align-top font-mono whitespace-nowrap tabular-nums'

/** A body row; a red coverage row reads on `danger-soft` (never colour alone: its state cell says so). */
export const tableRow = cva('border-b border-border last:border-b-0', {
  variants: {
    tone: {
      default: '',
      danger: 'bg-danger-soft text-danger-soft-foreground',
    },
  },
  defaultVariants: { tone: 'default' },
})
