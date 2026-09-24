import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Progress } from './progress'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip'

describe('Progress', () => {
  it('exposes its value to assistive technology', () => {
    render(<Progress value={40} aria-label="Tiến độ tuần" />)
    const bar = screen.getByRole('progressbar', { name: 'Tiến độ tuần' })
    expect(bar.getAttribute('aria-valuenow')).toBe('40')
  })

  it.each([
    [140, '100'],
    [-5, '0'],
  ])('clamps %i to %s', (value, expected) => {
    render(<Progress value={value} aria-label="Tiến độ" />)
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe(expected)
  })

  it('uses the track accent when asked', () => {
    const { container } = render(<Progress value={10} tone="track" aria-label="DSA" />)
    const indicator = container.querySelector('[data-slot="progress-indicator"]')
    expect(indicator?.className).toContain('bg-track')
  })
})

describe('Tooltip', () => {
  it('shows its content when the trigger receives keyboard focus', async () => {
    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>Ôn tập</TooltipTrigger>
          <TooltipContent>24 thẻ đến hạn</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    )
    await userEvent.setup().tab()
    expect((await screen.findByRole('tooltip')).textContent).toContain('24 thẻ đến hạn')
  })
})
