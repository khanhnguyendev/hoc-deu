import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { vi } from '@/lib/i18n/vi'
import AdminBotLoading from './loading'

describe('(admin)/admin/bot/loading', () => {
  it('shows the page skeleton, announced as loading', () => {
    const { container } = render(<AdminBotLoading />)
    expect(screen.getByRole('status')).toBeTruthy()
    expect(screen.getByText(vi.common.loading)).toBeTruthy()
    expect(container.querySelector('[data-slot="loading-state"]')).not.toBeNull()
  })
})
