import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { vi } from '@/lib/i18n/vi'
import TodayLoading from './loading'

describe('(app)/today/loading', () => {
  it('shows the page skeleton', () => {
    render(<TodayLoading />)
    expect(screen.getByRole('status')).toBeTruthy()
    expect(screen.getByText(vi.common.loading)).toBeTruthy()
  })
})
