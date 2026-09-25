import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { mdxComponents } from '../../mdx/components'
import { VarTable } from './var-table'

const Table = mdxComponents.table

function rows() {
  return (
    <>
      <thead>
        <tr>
          <th>i</th>
          <th>x</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>0</td>
          <td>2</td>
        </tr>
      </tbody>
    </>
  )
}

describe('VarTable', () => {
  it('is a keyboard-focusable scroll region named by its caption', () => {
    render(
      <VarTable caption="nums = [2, 7], target = 9">
        <table>{rows()}</table>
      </VarTable>,
    )
    const region = screen.getByRole('region', { name: 'nums = [2, 7], target = 9' })
    expect(region.tabIndex).toBe(0)
    expect(region.className).toContain('overflow-x-auto')
    expect(region?.contains(screen.getByRole('table'))).toBe(true)
  })

  it('falls back to "Bảng biến" without a caption', () => {
    render(
      <VarTable>
        <table>{rows()}</table>
      </VarTable>,
    )
    expect(screen.getByRole('region', { name: 'Bảng biến' })).toBeTruthy()
  })

  it('sets its cells in the mono font', () => {
    render(
      <VarTable>
        <table>{rows()}</table>
      </VarTable>,
    )
    expect(screen.getByRole('region').className).toContain('font-mono')
  })

  it('holds the MDX table without a second scroll region', () => {
    render(
      <VarTable caption="c">
        <Table>{rows()}</Table>
      </VarTable>,
    )
    expect(screen.getAllByRole('region')).toHaveLength(1)
    expect(screen.getByRole('table')).toBeTruthy()
  })

  it('leaves a table outside VarTable in its own focusable region', () => {
    render(<Table>{rows()}</Table>)
    const region = screen.getByRole('region', { name: 'Bảng' })
    expect(region.tabIndex).toBe(0)
  })
})
