import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { vi } from '@/lib/i18n/vi'
import AdminContentLoading from './loading'

describe('(admin)/admin/content/loading', () => {
  it('shows the page skeleton, announced as loading', () => {
    const { container } = render(<AdminContentLoading />)
    expect(screen.getByRole('status')).toBeTruthy()
    expect(screen.getByText(vi.common.loading)).toBeTruthy()
    expect(container.querySelector('[data-slot="loading-state"]')).not.toBeNull()
  })
})
