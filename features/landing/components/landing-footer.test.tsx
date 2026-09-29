import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LandingFooter } from './landing-footer'

describe('LandingFooter', () => {
  it('is the contentinfo landmark with the repository link and the licences', () => {
    render(<LandingFooter />)
    const footer = screen.getByRole('contentinfo')
    const link = within(footer).getByRole('link', { name: 'Mã nguồn mở trên GitHub' })
    expect(link.getAttribute('href')).toBe('https://github.com/khanhnguyendev/hoc-deu')
    expect(link.className).not.toContain('text-primary')
    expect(within(footer).getByText('Mã nguồn MIT · Nội dung CC BY-NC-SA 4.0')).toBeTruthy()
    expect(within(footer).getByRole('link', { name: 'Học Đều' }).getAttribute('href')).toBe('/')
  })
})
