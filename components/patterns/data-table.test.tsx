import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  DataTable,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
  DataTableRowHeader,
} from './data-table'

function Table() {
  return (
    <DataTable label="Mục theo loại — DSA">
      <DataTableHead>
        <DataTableHeader>Loại</DataTableHeader>
        <DataTableHeader>Đang dùng</DataTableHeader>
      </DataTableHead>
      <tbody>
        <DataTableRow>
          <DataTableRowHeader lang="en">Problem</DataTableRowHeader>
          <DataTableCell numeric>1.234</DataTableCell>
        </DataTableRow>
        <DataTableRow tone="danger" data-state="red">
          <DataTableRowHeader numeric>4</DataTableRowHeader>
          <DataTableCell>Cần bổ sung</DataTableCell>
        </DataTableRow>
      </tbody>
    </DataTable>
  )
}

describe('DataTable (parked #1)', () => {
  it('is a labelled, focusable scroll region around a table with column and row headers', () => {
    render(<Table />)
    const region = screen.getByRole('region', { name: 'Mục theo loại — DSA' })
    expect(region.getAttribute('tabindex')).toBe('0')
    const table = within(region).getByRole('table')
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((th) => th.textContent),
    ).toEqual(['Loại', 'Đang dùng'])
    const problem = within(table).getByRole('rowheader', { name: 'Problem' })
    expect(problem.getAttribute('lang')).toBe('en')
  })

  it('sets numbers in mono with tabular figures, and a danger row on danger-soft', () => {
    render(<Table />)
    expect(screen.getByText('1.234').className).toContain('tabular-nums')
    expect(screen.getByText('Cần bổ sung').className).not.toContain('tabular-nums')
    const red = screen.getByText('Cần bổ sung').closest('tr')!
    expect(red.className).toContain('bg-danger-soft')
    expect(red.getAttribute('data-state')).toBe('red')
    expect(screen.getByRole('rowheader', { name: '4' }).className).toContain('font-mono')
  })
})
