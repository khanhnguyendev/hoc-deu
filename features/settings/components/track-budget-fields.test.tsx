import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type * as React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { TrackBudgetFields } from './track-budget-fields'

const DSA = { id: 'dsa', roadmaps: [{ id: '8w', recommendedBelowMinutes: 75 }, { id: '10w' }] }
const ENGLISH = { id: 'english', roadmaps: [{ id: '10w' }] }

function setup(props: Partial<React.ComponentProps<typeof TrackBudgetFields>> = {}) {
  const onMinutesChange = vi.fn()
  const onVariantChange = vi.fn()
  const view = render(
    <form aria-label="Lộ trình">
      <TrackBudgetFields
        track={DSA}
        minutes="60"
        onMinutesChange={onMinutesChange}
        variant="8w"
        onVariantChange={onVariantChange}
        fallbackMinutes={60}
        errors={{}}
        {...props}
      />
    </form>,
  )
  const form = () => new FormData(view.container.querySelector('form')!)
  return { onMinutesChange, onVariantChange, form, user: userEvent.setup() }
}

const minutes = () => screen.getByRole('spinbutton', { name: 'Số phút mỗi ngày' })

describe('TrackBudgetFields', () => {
  it('names the fields budgetMinutes and roadmapVariant for the form', () => {
    const { form } = setup()
    expect(form().get('budgetMinutes')).toBe('60')
    expect(form().get('roadmapVariant')).toBe('8w')
  })

  it('offers the roadmaps with the simulated finish for the typed minutes', () => {
    setup({ minutes: '90' })
    expect(screen.getByRole('radiogroup', { name: 'Phiên bản lộ trình' })).toBeTruthy()
    expect(screen.getByText(/Với 90 phút\/ngày, lộ trình 8 tuần/)).toBeTruthy()
  })

  it('falls back to the saved minutes for the finish while the field is not a valid budget', () => {
    setup({ minutes: '7', fallbackMinutes: 45 })
    expect(screen.getByText(/Với 45 phút\/ngày, lộ trình 8 tuần/)).toBeTruthy()
  })

  it('reports typing and picking', async () => {
    const { onMinutesChange, onVariantChange, user } = setup()
    await user.type(minutes(), '5')
    expect(onMinutesChange).toHaveBeenCalledWith('605')
    await user.click(screen.getByRole('radio', { name: /^10 tuần/ }))
    expect(onVariantChange).toHaveBeenCalledWith('10w')
  })

  it('shows a single roadmap as text and still sends it', () => {
    const { form } = setup({ track: ENGLISH, variant: '10w', minutes: '25' })
    expect(screen.queryByRole('radiogroup')).toBeNull()
    expect(screen.getByText('10 tuần')).toBeTruthy()
    expect(form().get('roadmapVariant')).toBe('10w')
  })

  it('links each error to its field', () => {
    setup({
      errors: {
        budgetMinutes: 'Nhập số phút từ 10 đến 240, bước 5 phút.',
        roadmapVariant: 'Chọn một phiên bản có trong lộ trình.',
      },
    })
    expect(minutes().getAttribute('aria-invalid')).toBe('true')
    const variantError = screen.getByText('Chọn một phiên bản có trong lộ trình.').closest('p')!
    expect(screen.getByRole('radiogroup').getAttribute('aria-describedby')).toBe(variantError.id)
    expect(screen.getByRole('radiogroup').getAttribute('aria-invalid')).toBe('true')
  })

  it('carries no aria-invalid on the variant group without a field error', () => {
    setup()
    expect(screen.getByRole('radiogroup').getAttribute('aria-invalid')).toBeNull()
  })
})
