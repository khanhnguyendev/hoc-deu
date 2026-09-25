import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ExternalLink } from './external-link'

describe('ExternalLink', () => {
  it('opens an https link in a new tab, safely, and says so', () => {
    render(<ExternalLink href="https://leetcode.com/problems/two-sum/">bài viết</ExternalLink>)
    const link = screen.getByRole('link', { name: 'bài viết (mở trong tab mới)' })
    expect(link.getAttribute('href')).toBe('https://leetcode.com/problems/two-sum/')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    expect(link.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(screen.getByText('(mở trong tab mới)').className).toContain('sr-only')
  })

  it.each(['javascript:alert(1)', 'http://x.test/', '/relative', undefined])(
    'renders %s as plain text, never a link (fail closed)',
    (href) => {
      render(<ExternalLink href={href}>chữ</ExternalLink>)
      expect(screen.queryByRole('link')).toBeNull()
      expect(screen.getByText('chữ')).toBeTruthy()
    },
  )
})
