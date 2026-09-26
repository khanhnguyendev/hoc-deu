import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { UnreadablePlan } from './unreadable-plan'

const router = vi.hoisted(() => ({ refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => router }))

describe('UnreadablePlan (M-4, M5-R26)', () => {
  it('says what failed and offers "Thử lại" (DESIGN_SYSTEM §9), which renders /today again', async () => {
    const user = userEvent.setup()
    render(<UnreadablePlan />)
    const alert = screen.getByRole('alert')
    expect(
      within(alert).getByRole('heading', { name: 'Không đọc được kế hoạch hôm nay' }),
    ).toBeTruthy()
    expect(alert.textContent).toContain('nếu vẫn lỗi')
    // Never promises that the plan repairs itself after a while.
    expect(alert.textContent).not.toMatch(/sau ít phút/)
    await user.click(within(alert).getByRole('button', { name: 'Thử lại' }))
    expect(router.refresh).toHaveBeenCalledTimes(1)
  })
})
