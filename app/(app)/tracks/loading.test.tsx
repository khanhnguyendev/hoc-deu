import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { vi } from '@/lib/i18n/vi'
import TracksLoading from './loading'

describe('(app)/tracks/loading', () => {
  it('shows the page skeleton', () => {
    render(<TracksLoading />)
    expect(screen.getByRole('status')).toBeTruthy()
    expect(screen.getByText(vi.common.loading)).toBeTruthy()
  })
})
