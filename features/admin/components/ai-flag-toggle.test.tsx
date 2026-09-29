import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi as mock } from 'vitest'
import { Toaster } from '@/components/ui/toaster'
import type { AccountStatus } from '@/lib/auth/dal'
import type { AdminActionResult } from '../actions'
import { AiFlagToggle } from './ai-flag-toggle'

const ID = '5b0c61a2-7f5e-4c3b-9a41-2f1d7c8e9a10'
let run = 0

function setup(
  status: AccountStatus,
  aiPersonalization: boolean,
  result?: AdminActionResult | Error,
) {
  run += 1
  const message = `Đã đổi (${run}).`
  const setAiFlag = mock.fn<(id: string, on: boolean) => Promise<AdminActionResult>>(async () => {
    if (result instanceof Error) throw result
    return result ?? { ok: true, message }
  })
  render(
    <>
      <AiFlagToggle
        user={{ id: ID, name: 'Trần Thị Bình', status, aiPersonalization }}
        setAiFlag={setAiFlag}
      />
      <Toaster />
    </>,
  )
  return { setAiFlag, message, user: userEvent.setup() }
}

const toggle = () => screen.getByRole('switch', { name: 'Cá nhân hoá AI cho Trần Thị Bình' })

describe('AiFlagToggle (decision 34)', () => {
  it.each([false, true])(
    'shows the flag (%s) under a visible label, named with the account',
    (on) => {
      setup('active', on)
      expect(screen.getByText('Cá nhân hoá AI')).toBeTruthy()
      expect(toggle().getAttribute('aria-checked')).toBe(String(on))
      expect((toggle() as HTMLButtonElement).disabled).toBe(false)
    },
  )

  it('turns the flag on: calls setAiFlag, toasts, and shows the new state', async () => {
    const { setAiFlag, message, user } = setup('active', false)
    await user.click(toggle())
    await waitFor(() => expect(setAiFlag).toHaveBeenCalledWith(ID, true))
    expect(await screen.findByText(message)).toBeTruthy()
    expect(toggle().getAttribute('aria-checked')).toBe('true')
  })

  it('turns the flag off', async () => {
    const { setAiFlag, user } = setup('active', true)
    await user.click(toggle())
    await waitFor(() => expect(setAiFlag).toHaveBeenCalledWith(ID, false))
  })

  it('on failure goes back to the saved state and says why in the row too', async () => {
    const { user } = setup('active', false, { ok: false, message: 'Không đổi được (x).' })
    await user.click(toggle())
    expect((await screen.findAllByText('Không đổi được (x).')).length).toBeGreaterThanOrEqual(1)
    await waitFor(() => expect(toggle().getAttribute('aria-checked')).toBe('false'))
    expect(toggle().getAttribute('aria-describedby')).toBeTruthy()
  })

  it('a thrown action (network) says "Không lưu được…" and never reaches the error boundary', async () => {
    const { user } = setup('active', false, new Error('offline'))
    await user.click(toggle())
    expect((await screen.findAllByText(/Không lưu được/)).length).toBeGreaterThanOrEqual(1)
  })

  it.each(['pending', 'suspended', 'rejected'] as const)(
    'is disabled for a %s account, with the reason',
    async (status) => {
      const { setAiFlag, user } = setup(status, true)
      expect((toggle() as HTMLButtonElement).disabled).toBe(true)
      expect(toggle().getAttribute('aria-checked')).toBe('true')
      expect(screen.getByText('Chỉ đổi được cho tài khoản đang hoạt động.')).toBeTruthy()
      await user.click(toggle())
      expect(setAiFlag).not.toHaveBeenCalled()
    },
  )
})
