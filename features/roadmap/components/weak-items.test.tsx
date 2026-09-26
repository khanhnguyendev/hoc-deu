import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { WeakItems } from './weak-items'

describe('WeakItems (§5.7, track page)', () => {
  it('lists the Weak items’ registry rows', () => {
    render(
      <WeakItems
        rows={[
          <a key="a" href="#lc-0001">
            Two Sum
          </a>,
          <a key="b" href="#lc-0167">
            Two Sum II
          </a>,
        ]}
      />,
    )
    const region = screen.getByRole('region', { name: 'Bài yếu' })
    expect(
      within(region)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Two Sum', 'Two Sum II'])
    expect(within(region).getByRole('list')).toBeTruthy()
  })

  it('says so when there is none (empty)', () => {
    render(<WeakItems rows={[]} />)
    const region = screen.getByRole('region', { name: 'Bài yếu' })
    expect(within(region).getByText('Chưa có bài yếu nào trong lộ trình này.')).toBeTruthy()
    expect(within(region).queryByRole('list')).toBeNull()
  })
})
