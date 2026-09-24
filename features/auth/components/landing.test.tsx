import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { Landing } from './landing'

it('shows the wordmark, the positioning line and a sign-in link-button', () => {
  render(<Landing />)
  expect(screen.getByRole('heading', { level: 1, name: 'Học Đều' })).toBeTruthy()
  expect(
    screen.getByText('Nền tảng học tập dẫn dắt bởi AI — mỗi ngày một chút, AI giúp bạn tiến đều.'),
  ).toBeTruthy()
  const link = screen.getByRole('link', { name: 'Đăng nhập' })
  expect(link.getAttribute('href')).toBe('/sign-in')
})
