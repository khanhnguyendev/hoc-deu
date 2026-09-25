import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AdminLink } from './admin-link'

describe('AdminLink — the "Quản trị" row (DESIGN_SYSTEM §5)', () => {
  it('links an admin to /admin', () => {
    render(<AdminLink isAdmin />)
    const link = screen.getByRole('link', { name: /^Quản trị/ })
    expect(link.getAttribute('href')).toBe('/admin')
  })

  it('renders nothing for a learner', () => {
    const { container } = render(<AdminLink isAdmin={false} />)
    expect(screen.queryByRole('link')).toBeNull()
    expect(container.innerHTML).toBe('')
  })
})
