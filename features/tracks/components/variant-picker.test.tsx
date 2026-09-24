import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type * as React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { VariantPicker } from './variant-picker'

const DSA_ROADMAPS = [{ id: '8w', recommendedBelowMinutes: 75 }, { id: '10w' }]

function setup(props: Partial<React.ComponentProps<typeof VariantPicker>> = {}) {
  const onValueChange = vi.fn<(id: string) => void>()
  render(
    <VariantPicker
      trackId="dsa"
      name="variant-dsa"
      roadmaps={DSA_ROADMAPS}
      budgetMinutes={60}
      value="8w"
      onValueChange={onValueChange}
      aria-label="Phiên bản DSA"
      {...props}
    />,
  )
  return { onValueChange }
}

const radio = (name: RegExp) => screen.getByRole('radio', { name })

describe('VariantPicker', () => {
  it('is a radio group of the roadmaps, labelled "8 tuần" / "10 tuần"', () => {
    setup()
    expect(screen.getByRole('radiogroup', { name: 'Phiên bản DSA' })).toBeTruthy()
    const names = screen.getAllByRole('radio').map((item) => item.textContent ?? '')
    expect(names).toHaveLength(2)
    expect(radio(/^8 tuần/).getAttribute('aria-checked')).toBe('true')
    expect(radio(/^10 tuần/).getAttribute('aria-checked')).toBe('false')
  })

  it('shows the simulated finish for each choice at the given budget (§5.11)', () => {
    setup({ budgetMinutes: 60 })
    expect(
      screen.getByText(
        'Với 60 phút/ngày, lộ trình 8 tuần thường hoàn thành sau ~12 tuần (90 %: ~12,4 tuần)',
      ),
    ).toBeTruthy()
    expect(
      screen.getByText(
        'Với 60 phút/ngày, lộ trình 10 tuần thường hoàn thành sau ~17 tuần (90 %: ~17,4 tuần)',
      ),
    ).toBeTruthy()
  })

  it('updates the finish text when the budget changes', () => {
    setup({ budgetMinutes: 75, value: '10w' })
    expect(
      screen.getByText(
        'Với 75 phút/ngày, lộ trình 10 tuần thường hoàn thành sau ~13 tuần (90 %: ~13,6 tuần)',
      ),
    ).toBeTruthy()
  })

  it('reports the picked roadmap', async () => {
    const { onValueChange } = setup()
    await userEvent.setup().click(radio(/^10 tuần/))
    expect(onValueChange).toHaveBeenCalledWith('10w')
  })

  it('shows no finish line for a track without a projection', () => {
    setup({ trackId: 'english', roadmaps: [{ id: '10w' }], budgetMinutes: 25, value: '10w' })
    expect(screen.getAllByRole('radio')).toHaveLength(1)
    expect(screen.queryByText(/hoàn thành sau/)).toBeNull()
  })
})
