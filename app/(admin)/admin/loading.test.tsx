import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { vi } from '@/lib/i18n/vi'
import AdminOverviewLoading from './loading'

describe('(admin)/admin/loading', () => {
  it('/admin shows the page skeleton (/admin/content: content/loading.test.tsx)', () => {
    render(<AdminOverviewLoading />)
    expect(screen.getByRole('status')).toBeTruthy()
    expect(screen.getByText(vi.common.loading)).toBeTruthy()
  })
})
