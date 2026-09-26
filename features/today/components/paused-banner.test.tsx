import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PausedBanner } from './paused-banner'

vi.mock('@/components/ui/toaster', () => ({ toast: () => {} }))

const resume = async () => ({ ok: true, message: '' })

describe('PausedBanner (§5.2, §5.8)', () => {
  it('a warning banner: the sentence, the plan’s date and "Học tiếp hôm nay" when offered', () => {
    const { container } = render(<PausedBanner planDate="2026-09-25" offerResume resume={resume} />)
    const banner = container.querySelector('[data-slot="banner"]')!
    expect(banner.getAttribute('data-tone')).toBe('warning')
    expect(banner.textContent).toContain(
      'Lộ trình đang tạm dừng — hoàn thành ít nhất một phần để tiếp tục.',
    )
    expect(banner.textContent).toContain('Kế hoạch ngày 25 tháng 9, 2026')
    expect(screen.getByRole('button', { name: 'Học tiếp hôm nay' })).toBeTruthy()
  })

  it('offers no resume while the plan is at most 2 days old', () => {
    render(<PausedBanner planDate="2026-09-26" offerResume={false} resume={resume} />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText(/Kế hoạch ngày 26 tháng 9, 2026/)).toBeTruthy()
  })
})
