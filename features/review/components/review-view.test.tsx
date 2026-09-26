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

describe('ReviewView (task 5.3)', () => {
  it('titles the page "Ôn tập" with the total due', () => {
    render(
      <ReviewView
        page={{
          ...BASE,
          entries: [
            {
              itemId: 'dsa:p1',
              trackId: 'dsa',
              mode: 'recall',
              minutes: 5,
              weak: false,
              overdueDays: 0,
              href: '/x',
            },
          ],
        }}
        rows={[]}
        record={record}
      />,
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Ôn tập' })).toBeTruthy()
    expect(screen.getByText('1 mục cần ôn hôm nay')).toBeTruthy()
  })

  it('shows the filter chips only when there is a track to filter by', () => {
    const { rerender } = render(<ReviewView page={BASE} rows={[]} record={record} />)
    expect(screen.queryByRole('navigation')).toBeNull()
    rerender(
      <ReviewView
        page={{ ...BASE, tracks: [{ id: 'dsa', title: 'DSA', count: 0 }] }}
        rows={[]}
        record={record}
      />,
    )
    expect(screen.getByRole('navigation')).toBeTruthy()
  })

  it('RF-4: nothing due — the empty state, linking to /today', () => {
    render(<ReviewView page={BASE} rows={[]} record={record} />)
    expect(screen.getByText('Không có bài nào cần ôn hôm nay')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Hôm nay' }).getAttribute('href')).toBe('/today')
  })

  it('shows the card session under "Thẻ" whenever something is due', () => {
    render(
      <ReviewView
        page={{
          ...BASE,
          entries: [
            {
              itemId: 'dsa:p1',
              trackId: 'dsa',
              mode: 'recall',
              minutes: 5,
              weak: false,
              overdueDays: 0,
              href: '/x',
            },
          ],
        }}
        rows={[]}
        record={record}
      />,
    )
    expect(screen.getByRole('heading', { level: 2, name: 'Thẻ' })).toBeTruthy()
    expect(screen.queryByRole('heading', { level: 2, name: 'Bài cần ôn' })).toBeNull()
  })

  it('shows the other due items under "Bài cần ôn" when there are rows', () => {
    render(
      <ReviewView
        page={{
          ...BASE,
          entries: [
            {
              itemId: 'dsa:p1',
              trackId: 'dsa',
              mode: 'recall',
              minutes: 5,
              weak: false,
              overdueDays: 0,
              href: '/x',
            },
          ],
        }}
        rows={[{ itemId: 'dsa:p1', row: <a href="/x">Two Sum</a>, weak: false }]}
        record={record}
      />,
    )
    expect(screen.getByRole('heading', { level: 2, name: 'Bài cần ôn' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Two Sum' })).toBeTruthy()
  })
})
