import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ReviewPage } from '../queries'
import { ReviewView } from './review-view'

const REQUEST_ID = '5f0c8a4e-2b1d-4c3a-9e8f-7a6b5c4d3e2f'

const BASE: ReviewPage = {
  entries: [],
  cards: [],
  tracks: [],
  track: null,
  requestId: REQUEST_ID,
}

const record = async () => ({ ok: true, message: 'Đã lưu.', autoCheckedIn: [] })

const entry = (itemId: string, trackId: string) => ({
  itemId,
  trackId,
  mode: 'review' as const,
  minutes: 0.5,
  weak: false,
  overdueDays: 0,
  href: '/x',
})

describe('ReviewView (task 5.3)', () => {
  it('titles the page "Ôn tập" with the total due, under the current filter', () => {
    render(
      <ReviewView
        page={{ ...BASE, entries: [entry('dsa:p1', 'dsa')] }}
        rows={[]}
        record={record}
      />,
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Ôn tập' })).toBeTruthy()
    expect(screen.getByText('1 mục cần ôn hôm nay')).toBeTruthy()
  })

  it('RF-4: nothing due — the empty state', () => {
    render(<ReviewView page={BASE} rows={[]} record={record} />)
    expect(screen.getByText('Không có bài nào cần ôn hôm nay')).toBeTruthy()
  })

  it('keys the session by `page.track`: a genuine filter change starts a fresh session (I2)', () => {
    const englishCard = {
      itemId: 'english:e1',
      sides: {
        front: 'blocker',
        back: 'y',
        lang: { front: 'en' as const, back: 'vi' as const, hint: 'vi' as const },
      },
    }
    const { rerender } = render(
      <ReviewView
        page={{ ...BASE, entries: [entry('english:e1', 'english')], cards: [englishCard] }}
        rows={[]}
        record={record}
      />,
    )
    expect(screen.getByRole('heading', { level: 2, name: 'Thẻ' })).toBeTruthy()

    // A different `?track=` — a new page.track — must remount with the new filter's own decision
    // (no cards for dsa), not keep the previous mount's "Thẻ" section (I2).
    rerender(
      <ReviewView
        page={{ ...BASE, track: 'dsa', entries: [entry('dsa:p1', 'dsa')], cards: [] }}
        rows={[{ itemId: 'dsa:p1', row: <a href="/x">Two Sum</a> }]}
        record={record}
      />,
    )
    expect(screen.queryByRole('heading', { level: 2, name: 'Thẻ' })).toBeNull()
    expect(screen.getByRole('heading', { level: 2, name: 'Bài cần ôn' })).toBeTruthy()
  })
})
