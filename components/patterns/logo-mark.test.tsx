import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LogoMark } from './logo-mark'

describe('LogoMark', () => {
  it('is a decorative, six-cell staircase (brand kit README, task 6.0b)', () => {
    const { container } = render(<LogoMark />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('aria-hidden')).toBe('true')
    const cells = container.querySelectorAll('rect')
    expect(cells).toHaveLength(6)
  })

  it('deepens the heat ramp left to right (by column), and swaps to the dark ramp in the dark theme', () => {
    const { container } = render(<LogoMark />)
    const fills = Array.from(container.querySelectorAll('rect')).map(
      (cell) => cell.className.baseVal,
    )
    // CELLS = [[2,0],[2,1],[2,2],[1,1],[1,2],[0,2]]: cell 1 is column 0, cells 2 & 4 are column 1,
    // cells 3, 5 & 6 are column 2 — the ramp deepens by column, not by row.
    expect(fills[1]).toBe(fills[3])
    expect(fills[2]).toBe(fills[4])
    expect(fills[2]).toBe(fills[5])
    expect(new Set(fills).size).toBe(3)
    for (const fill of fills) {
      expect(fill).toContain('fill-heat-')
      expect(fill).toContain('dark:fill-heat-')
    }
  })

  it('accepts a className on the svg', () => {
    const { container } = render(<LogoMark className="size-8" />)
    expect(container.querySelector('svg')?.getAttribute('class')).toContain('size-8')
  })
})
