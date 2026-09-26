import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { vi } from '@/lib/i18n/vi'
import ReviewLoading from './loading'

describe('(app)/review/loading', () => {
  it('shows the page skeleton', () => {
    render(<ReviewLoading />)
    expect(screen.getByRole('status')).toBeTruthy()
    expect(screen.getByText(vi.common.loading)).toBeTruthy()
  })
})
