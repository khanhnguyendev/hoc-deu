import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { VerificationBadge } from './verification-badge'

describe('VerificationBadge', () => {
  it('tested: "Đã kiểm thử" with CircleCheck and a one-line explanation', () => {
    const { container } = render(<VerificationBadge verification="tested" />)
    expect(screen.getByText('Đã kiểm thử')).toBeTruthy()
    expect(screen.getByText(/test case/)).toBeTruthy()
    expect(container.querySelector('svg.lucide-circle-check')).not.toBeNull()
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('compile-only: "Chỉ biên dịch" with Info and its explanation', () => {
    const { container } = render(<VerificationBadge verification="compile-only" />)
    expect(screen.getByText('Chỉ biên dịch')).toBeTruthy()
    expect(screen.getByText(/biên dịch được/)).toBeTruthy()
    expect(container.querySelector('svg.lucide-info')).not.toBeNull()
  })

  it('icon variant (rows): the icon with a visually hidden label, no explanation', () => {
    const { container } = render(<VerificationBadge verification="tested" variant="icon" />)
    const label = screen.getByText('Đã kiểm thử')
    expect(label.className).toContain('sr-only')
    expect(screen.queryByText(/test case/)).toBeNull()
    expect(container.querySelector('svg.lucide-circle-check')).not.toBeNull()
  })
})
