import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { vi } from '@/lib/i18n/vi'
import AdminOverviewLoading from './loading'
import AdminContentLoading from './content/loading'

describe('(admin)/admin loading states', () => {
  it.each([
    ['/admin', AdminOverviewLoading],
    ['/admin/content', AdminContentLoading],
  ])('%s shows the page skeleton', (_path, Loading) => {
    render(<Loading />)
    expect(screen.getByRole('status')).toBeTruthy()
    expect(screen.getByText(vi.common.loading)).toBeTruthy()
  })
})
