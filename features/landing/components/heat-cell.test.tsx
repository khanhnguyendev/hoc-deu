import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HeatCell } from './heat-cell'
import { MissedDayGrid } from './missed-day-grid'
import { TodayPreview } from './today-preview'

describe('HeatCell blank', () => {
  it('is solid by default and dashed only when `blank`', () => {
    const { container } = render(
      <>
        <HeatCell level={0} />
        <HeatCell level={0} blank />
      </>,
    )
    const [solid, blank] = [...container.querySelectorAll('[data-slot="heat-cell"]')]
    expect(solid?.className).not.toContain('border-dashed')
    expect(blank?.className).toContain('border-dashed')
  })

  it('leaves the strip’s future days solid but marks the missed grid’s blanks', () => {
    const strip = render(<TodayPreview />).container
    for (const cell of strip.querySelectorAll('[data-slot="heat-cell"]')) {
      expect(cell.className).not.toContain('border-dashed')
    }
    const grid = render(<MissedDayGrid />).container
    const blanks = grid.querySelectorAll('[data-level="0"]')
    expect(blanks).toHaveLength(2)
    for (const cell of blanks) expect(cell.className).toContain('border-dashed')
  })
})
