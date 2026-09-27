import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { outcomeBinding } from '../fixtures'
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

  it('task 5.2c: with an outcome binding — the status pill, "Trong kế hoạch hôm nay", the item actions', () => {
    const { container } = render(
      <ItemPageFrame
        status="active"
        title="Two Sum"
        meta={['#1']}
        outcome={outcomeBinding(vi.fn(), {
          plan: { blockId: 'b-new', label: 'Trong kế hoạch hôm nay' },
          blockId: 'b-new',
        })}
      >
        <p>Nội dung</p>
      </ItemPageFrame>,
    )
    const meta = container.querySelector('[data-slot="item-meta"]') as HTMLElement
    expect(within(meta).getByText('Chưa học').closest('[data-slot="status-pill"]')).toBeTruthy()
    expect(within(meta).getByText('Trong kế hoạch hôm nay')).toBeTruthy()
    // The item-wide actions come after the body: "Bỏ qua mục này" for an item not studied yet.
    const frame = container.firstElementChild as HTMLElement
    expect(frame.lastElementChild?.getAttribute('data-slot')).toBe('item-actions')
    expect(screen.getByRole('button', { name: 'Bỏ qua mục này' })).toBeTruthy()
  })

  it('task 5.2c: the learner’s own status; no plan label off the plan', () => {
    const { container } = render(
      <ItemPageFrame
        status="active"
        title="Two Sum"
        outcome={outcomeBinding(vi.fn(), { state: { status: 'weak', level: 1, dueOn: null } })}
      />,
    )
    const meta = container.querySelector('[data-slot="item-meta"]') as HTMLElement
    expect(meta.querySelector('[data-slot="status-pill"]')?.getAttribute('data-status')).toBe(
      'weak',
    )
    expect(screen.queryByText('Trong kế hoạch hôm nay')).toBeNull()
  })

  it('task 5.2c: no pill, no plan label and no actions without a binding (read-only)', () => {
    const { container } = render(<ItemPageFrame status="retired" title="3Sum" meta={['#15']} />)
    expect(container.querySelector('[data-slot="status-pill"]')).toBeNull()
    expect(container.querySelector('[data-slot="item-actions"]')).toBeNull()
  })
})
