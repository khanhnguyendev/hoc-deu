import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DifficultyBadge, PremiumBadge } from './difficulty-badge'

describe('DifficultyBadge', () => {
  it.each([
    ['E', 'Easy', 'success'],
    ['M', 'Medium', 'warning'],
    ['H', 'Hard', 'danger'],
  ] as const)('%s reads "%s" (LeetCode terms stay English) on a %s badge', (level, label, tone) => {
    render(<DifficultyBadge difficulty={level} />)
    const badge = screen.getByText(label)
    expect(badge.getAttribute('data-tone')).toBe(tone)
    expect(badge.getAttribute('data-difficulty')).toBe(level)
  })
})

describe('PremiumBadge', () => {
  it('reads "Premium" with a lock icon', () => {
    const { container } = render(<PremiumBadge />)
    expect(screen.getByText('Premium')).toBeTruthy()
    expect(container.querySelector('svg.lucide-lock')?.getAttribute('aria-hidden')).toBe('true')
  })
})
