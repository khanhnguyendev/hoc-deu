import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DSA_TITLE } from '../__tests__/fixtures'
import { WeakAreas } from './weak-areas'

describe('WeakAreas (§5.7)', () => {
  it('lists each weak topic as a link to its track, with its track and Weak count', () => {
    render(
      <WeakAreas
        topics={[
          { trackId: 'dsa', title: 'Arrays & Hashing', trackTitle: DSA_TITLE, count: 3 },
          { trackId: 'dsa', title: 'Two Pointers', trackTitle: DSA_TITLE, count: 2 },
        ]}
      />,
    )
    const region = screen.getByRole('region', { name: 'Chủ đề cần củng cố' })
    const links = within(region).getAllByRole('link')
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/t/dsa', '/t/dsa'])
    expect(links[0]!.textContent).toContain('Arrays & Hashing')
    expect(links[0]!.textContent).toContain(DSA_TITLE)
    expect(links[0]!.textContent).toContain('3 bài yếu')
    // Status by icon + label, never colour alone.
    expect(within(links[0]!).getByText('Yếu')).toBeTruthy()
  })

  it('says there is none (empty)', () => {
    render(<WeakAreas topics={[]} />)
    const region = screen.getByRole('region', { name: 'Chủ đề cần củng cố' })
    expect(within(region).queryByRole('link')).toBeNull()
    expect(region.textContent).toContain('Chưa có chủ đề nào cần củng cố.')
  })
})
