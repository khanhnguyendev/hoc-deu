import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { vi } from '@/lib/i18n/vi'
import SettingsLoading from './loading'

describe('(app)/settings/loading', () => {
  it('shows the page skeleton', () => {
    render(<SettingsLoading />)
    expect(screen.getByRole('status')).toBeTruthy()
    expect(screen.getByText(vi.common.loading)).toBeTruthy()
  })
})
