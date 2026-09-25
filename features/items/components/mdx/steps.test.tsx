import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Step, Steps } from './steps'

describe('Steps / Step', () => {
  it('renders a numbered list, one item per step, with optional titles', () => {
    render(
      <Steps>
        <Step title="Khởi tạo">
          Đặt <code>left = 0</code>.
        </Step>
        <Step>
          <p>So sánh tổng với target.</p>
        </Step>
      </Steps>,
    )
    const list = screen.getByRole('list')
    expect(list.tagName).toBe('OL')
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(within(items[0]!).getByText('Khởi tạo')).toBeTruthy()
    expect(items[0]!.textContent).toContain('Đặt left = 0.')
    expect(items[1]!.textContent).toBe('So sánh tổng với target.')
  })

  it('renders nothing for an empty list (the check rejects one; render defensively)', () => {
    const { container } = render(<Steps />)
    expect(container.innerHTML).toBe('')
  })
})
