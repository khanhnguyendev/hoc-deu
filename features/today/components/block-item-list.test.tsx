import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BlockItemList } from './block-item-list'

describe('BlockItemList', () => {
  it('lists the rows in order, "Chưa có ghi chú" under a note-less problem (RF-4)', () => {
    render(
      <BlockItemList
        items={[
          { itemId: 'a', row: <a href="/a">Two Sum</a>, noNote: false },
          { itemId: 'b', row: <a href="/b">Add Two Numbers</a>, noNote: true },
        ]}
      />,
    )
    const items = screen.getAllByRole('listitem')
    expect(items.map((item) => item.textContent)).toEqual([
      'Two Sum',
      'Add Two NumbersChưa có ghi chú',
    ])
  })

  it('says the block has no items when empty', () => {
    render(<BlockItemList items={[]} />)
    expect(screen.queryByRole('list')).toBeNull()
    expect(screen.getByText('Khối này chưa có bài nào.')).toBeTruthy()
  })
})
