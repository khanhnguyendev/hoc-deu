import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Landing } from './landing'

describe('Landing', () => {
  it('shows the wordmark, the positioning line and a sign-in link-button', () => {
    render(<Landing />)
    expect(screen.getByRole('heading', { level: 1, name: 'Học Đều' })).toBeTruthy()
    expect(
      screen.getByText(
        'Nền tảng học tập dẫn dắt bởi AI — mỗi ngày một chút, AI giúp bạn tiến đều.',
      ),
    ).toBeTruthy()
    const link = screen.getByRole('link', { name: 'Đăng nhập' })
    expect(link.getAttribute('href')).toBe('/sign-in')
    expect(screen.queryByText('Tài khoản của bạn đã được xoá.')).toBeNull()
  })

  it('shows the deleted-account notice when `deleted` (§4.6)', () => {
    render(<Landing deleted />)
    expect(screen.getByText('Tài khoản của bạn đã được xoá.')).toBeTruthy()
  })
})
