import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PracticeCard } from './practice-card'

describe('PracticeCard', () => {
  it('links to the problem with its LeetCode number, English title and difficulty', () => {
    render(<PracticeCard title="3Sum" href="/t/dsa/items/lc-0015" leetcode={15} difficulty="M" />)
    // The accessible name reads as words, not "Bài luyện tập#153SumMedium".
    const link = screen.getByRole('link', { name: 'Bài luyện tập #15 3Sum Medium' })
    expect(link.getAttribute('href')).toBe('/t/dsa/items/lc-0015')
    expect(screen.getByText('3Sum').closest('[lang="en"]')).not.toBeNull()
  })

  it.each([
    ['E', 'Easy'],
    ['M', 'Medium'],
    ['H', 'Hard'],
  ] as const)(
    'labels difficulty %s "%s" with the one DifficultyBadge (M3-R3)',
    (difficulty, label) => {
      render(<PracticeCard title="x" href="/x" leetcode={1} difficulty={difficulty} />)
      const badge = screen.getByText(label)
      expect(badge.getAttribute('data-difficulty')).toBe(difficulty)
    },
  )

  it('omits the number and difficulty when they are unknown', () => {
    render(<PracticeCard title="Custom" href="/x" leetcode={null} difficulty={null} />)
    const text = screen.getByRole('link').textContent ?? ''
    expect(text).not.toContain('#')
    for (const label of ['Easy', 'Medium', 'Hard']) expect(text).not.toContain(label)
  })
})
