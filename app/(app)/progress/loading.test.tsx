import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { vi } from '@/lib/i18n/vi'
import ProgressLoading from './loading'

describe('(app)/progress/loading', () => {
  it('shows the page skeleton', () => {
    render(<ProgressLoading />)
    expect(screen.getByRole('status')).toBeTruthy()
    expect(screen.getByText(vi.common.loading)).toBeTruthy()
  })
})
