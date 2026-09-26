import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BlockItemList } from './block-item-list'

describe('BlockItemList', () => {
  it('lists the registry rows in order, as they are (a Row carries its own note hint, M5-R26)', () => {
    render(
      <BlockItemList
        items={[
          { itemId: 'a', row: <a href="/a">Two Sum</a> },
          {
            itemId: 'b',
            row: (
              <a href="/b">
                Add Two Numbers <span>Chưa có ghi chú</span>
              </a>
            ),
          },
        ]}
      />,
    )
    const items = screen.getAllByRole('listitem')
    expect(items.map((item) => item.textContent)).toEqual([
      'Two Sum',
      'Add Two Numbers Chưa có ghi chú',
    ])
    // The screen adds nothing of its own under a row.
    expect(items.map((item) => item.children.length)).toEqual([1, 1])
  })

  it('says the block has no items when empty', () => {
    render(<BlockItemList items={[]} />)
    expect(screen.queryByRole('list')).toBeNull()
    expect(screen.getByText('Khối này chưa có bài nào.')).toBeTruthy()
  })
})
