import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ShadowingSentences } from './shadowing-sentences'

describe('ShadowingSentences (§5.6)', () => {
  it('lists the sentences in English (lang="en"), named by its title', () => {
    render(
      <ShadowingSentences
        sentences={[
          { itemId: 'english:a', text: 'I have one blocker.' },
          { itemId: 'english:b', text: 'I have some bandwidth this afternoon.' },
        ]}
      />,
    )
    const list = screen.getByRole('list', { name: 'Đọc to các câu sau' })
    const items = screen.getAllByRole('listitem')
    expect(list).toBeTruthy()
    expect(items.map((item) => [item.textContent, item.getAttribute('lang')])).toEqual([
      ['I have one blocker.', 'en'],
      ['I have some bandwidth this afternoon.', 'en'],
    ])
  })

  it('says so when no card has a sentence (empty)', () => {
    render(<ShadowingSentences sentences={[]} />)
    expect(screen.queryByRole('list')).toBeNull()
    expect(screen.getByText('Chưa có câu mẫu cho khối này.')).toBeTruthy()
  })
})
