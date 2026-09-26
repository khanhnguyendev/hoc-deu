import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TodayError from './error'

describe('(app)/today/error', () => {
  it('says the plan could not be loaded, as the page h1, and retries', () => {
    const retry = vi.fn()
    render(<TodayError error={new Error('boom')} retry={retry} />)
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(
      screen.getByRole('heading', { level: 1, name: 'Không tải được kế hoạch hôm nay' }),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(retry).toHaveBeenCalledTimes(1)
  })
})
