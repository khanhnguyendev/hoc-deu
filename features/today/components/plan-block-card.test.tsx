import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { block, blockState, blockView, PLAN_ID, TODAY } from '../__tests__/fixtures'
import { PlanBlockCard } from './plan-block-card'

const row = (title: string) => <a href={`/t/dsa/items/${title}`}>{title}</a>

describe('PlanBlockCard (DESIGN_SYSTEM §9)', () => {
  it('is an article named by its kind and track, with the stripe, minutes and item rows', () => {
    const { container } = render(
      <PlanBlockCard
        view={blockView({ minutes: 45 })}
        slots={{
          items: [
            { itemId: 'dsa:lc-0001', row: row('Two Sum'), noNote: false },
            { itemId: 'dsa:lc-0002', row: row('Add Two Numbers'), noNote: true },
          ],
          sentences: [],
        }}
      />,
    )
    const card = screen.getByRole('article', { name: 'Bài mới Cấu trúc dữ liệu & Giải thuật' })
    expect(card.getAttribute('data-accent')).toBe('track-1')
    expect(container.querySelector('.bg-track')).not.toBeNull()
    expect(within(card).getByRole('heading', { level: 3, name: 'Bài mới' })).toBeTruthy()
    expect(card.textContent).toContain('45 phút')
    expect(
      within(card)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Two Sum', 'Add Two Numbers'])
    // RF-4: the note-less problem says so.
    expect(within(card).getAllByText('Chưa có ghi chú')).toHaveLength(1)
  })

  it('shows the over-budget hint only when flagged', () => {
    const { rerender } = render(<PlanBlockCard view={blockView({ overBudget: true })} />)
    expect(screen.getByText('Dài hơn thời gian dự kiến')).toBeTruthy()
    rerender(<PlanBlockCard view={blockView()} />)
    expect(screen.queryByText('Dài hơn thời gian dự kiến')).toBeNull()
  })

  it('renders its actions slot (empty until 5.2b) and the plain checked-in status row', () => {
    const { rerender } = render(
      <PlanBlockCard view={blockView()} actions={<button type="button">Check-in</button>} />,
    )
    expect(screen.getByRole('button', { name: 'Check-in' })).toBeTruthy()
    expect(screen.queryByText('Đã check-in')).toBeNull()

    const done = blockState(PLAN_ID, `${TODAY}:dsa:new:1`, {
      status: 'partial',
      minutes: 25,
      auto: true,
    })
    rerender(<PlanBlockCard view={blockView({ checkIn: done })} />)
    const status = screen.getByText('Đã check-in').parentElement!
    expect(status.textContent).toContain('Một phần')
    expect(status.textContent).toContain('25 phút')
    expect(status.textContent).toContain('tự động')
    expect(status.querySelector('[data-status="block-partial"]')).not.toBeNull()
  })

  it('shows a shadowing block’s sentences instead of rows', () => {
    render(
      <PlanBlockCard
        view={blockView({
          kindLabel: 'Shadowing',
          block: block(`${TODAY}:english:practice:2`, {
            kind: 'practice',
            trackId: 'english',
            tag: 'shadowing',
            shadowing: ['english:w01-blocker'],
          }),
        })}
        slots={{
          items: [],
          sentences: [{ itemId: 'english:w01-blocker', text: 'I have one blocker.' }],
        }}
      />,
    )
    expect(screen.getByText('I have one blocker.').getAttribute('lang')).toBe('en')
    expect(screen.queryByText('Khối này chưa có bài nào.')).toBeNull()
  })

  it('says so when a block has no rows (empty)', () => {
    render(<PlanBlockCard view={blockView()} />)
    expect(screen.getByText('Khối này chưa có bài nào.')).toBeTruthy()
  })
})
