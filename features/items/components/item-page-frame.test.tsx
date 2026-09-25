import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ItemPageFrame } from './item-page-frame'

describe('ItemPageFrame', () => {
  it('orders notice, h1, facts and body', () => {
    const { container } = render(
      <ItemPageFrame
        status="retired"
        title="Two Sum"
        description="Mô tả"
        actions={<a href="/x">Hành động</a>}
        meta={['#1', null, 'Arrays & Hashing']}
      >
        <p>Nội dung</p>
      </ItemPageFrame>,
    )
    const frame = container.firstElementChild as HTMLElement
    const slots = [...frame.children].map(
      (child) => child.getAttribute('data-slot') ?? child.tagName,
    )
    expect(slots).toEqual(['banner', 'page-header', 'item-meta', 'P'])
    expect(screen.getByRole('heading', { level: 1, name: 'Two Sum' })).toBeTruthy()
    expect(frame.querySelector('[data-slot="item-meta"]')?.children).toHaveLength(2)
  })

  it('an active item without a title or facts: only the body', () => {
    const { container } = render(
      <ItemPageFrame status="active">
        <p>Nội dung</p>
      </ItemPageFrame>,
    )
    const frame = container.firstElementChild as HTMLElement
    expect(frame.children).toHaveLength(1)
    expect(screen.queryByRole('heading')).toBeNull()
  })
})
