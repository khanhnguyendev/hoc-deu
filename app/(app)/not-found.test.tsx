import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import AppNotFound from './not-found'

describe('(app)/not-found', () => {
  it('shows the Vietnamese 404 inside the AppShell: an h1, a way home, and no second <main>', () => {
    const { container } = render(<AppNotFound />)
    expect(screen.getByRole('heading', { level: 1, name: 'Không tìm thấy trang' })).toBeTruthy()
    expect(screen.getByText('Trang bạn tìm không tồn tại hoặc đã được chuyển đi.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Về trang chủ' }).getAttribute('href')).toBe('/')
    expect(container.querySelector('main')).toBeNull()
  })
})
