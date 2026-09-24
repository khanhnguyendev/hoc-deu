import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StepIndicator } from './step-indicator'

const STEPS = ['Thông tin', 'Lộ trình', 'Lịch học', 'Xác nhận'] as const

describe('StepIndicator', () => {
  it('shows the current step as text', () => {
    render(<StepIndicator steps={STEPS} current={1} />)
    expect(screen.getByText('Bước 2/4: Lộ trình')).toBeTruthy()
  })

  it('marks only the current step in the step list', () => {
    render(<StepIndicator steps={STEPS} current={2} />)
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(4)
    expect(items[2]?.getAttribute('aria-current')).toBe('step')
    expect(items[0]?.getAttribute('aria-current')).toBeNull()
    expect(items[1]?.getAttribute('aria-current')).toBeNull()
    expect(items[3]?.getAttribute('aria-current')).toBeNull()
  })
})
