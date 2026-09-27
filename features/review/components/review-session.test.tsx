import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ReviewPage } from '../queries'
import { ReviewSession } from './review-session'

const REQUEST_ID = '5f0c8a4e-2b1d-4c3a-9e8f-7a6b5c4d3e2f'

const BASE: ReviewPage = {
  entries: [],
  cards: [],
  tracks: [],
  track: null,
  requestId: REQUEST_ID,
}

const entry = (itemId: string, trackId: string) => ({
  itemId,
  trackId,
  mode: 'recall' as const,
  minutes: 5,
  weak: false,
  overdueDays: 0,
  href: '/x',
})

const record = vi.fn(async () => ({ ok: true, message: 'Đã lưu.', autoCheckedIn: [] }))
const row = (itemId: string) => ({ itemId, row: <a href={`/${itemId}`}>{itemId}</a> })

describe('ReviewSession (task 5.3 review, findings I2/I3/M2/M3)', () => {
  it('shows the filter chips only when some track has something due (unfiltered), frozen at mount like the rest', () => {
    render(
      <ReviewSession
        page={{ ...BASE, tracks: [{ id: 'dsa', title: 'DSA', count: 0 }] }}
        rows={[]}
        record={record}
      />,
    )
    expect(screen.queryByRole('navigation')).toBeNull()

    render(
      <ReviewSession
        page={{
          ...BASE,
          entries: [entry('dsa:p1', 'dsa')],
          tracks: [{ id: 'dsa', title: 'DSA', count: 1 }],
        }}
        rows={[]}
        record={record}
      />,
    )
    expect(screen.getByRole('navigation')).toBeTruthy()
  })

  it('RF-4: nothing due at all — the generic empty state, linking to /today', () => {
    render(<ReviewSession page={BASE} rows={[]} record={record} />)
    expect(screen.getByText('Không có bài nào cần ôn hôm nay')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Hôm nay' }).getAttribute('href')).toBe('/today')
  })

  it('a filter with 0 due while another track still does: the filter-specific empty line (M3)', () => {
    render(
      <ReviewSession
        page={{
          ...BASE,
          entries: [],
          track: 'dsa',
          tracks: [
            { id: 'dsa', title: 'DSA', count: 0 },
            { id: 'english', title: 'English', count: 2 },
          ],
        }}
        rows={[]}
        record={record}
      />,
    )
    expect(screen.getByText('Lộ trình này không có bài nào cần ôn hôm nay')).toBeTruthy()
    expect(screen.queryByText('Không có bài nào cần ôn hôm nay')).toBeNull()
  })

  it('shows "Thẻ" only when mounted with cards; a revalidation dropping cards to 0 does not hide it (I3/M2)', () => {
    const page: ReviewPage = {
      ...BASE,
      entries: [entry('english:e1', 'english')],
      cards: [
        {
          itemId: 'english:e1',
          sides: { front: 'x', back: 'y', lang: { front: 'en', back: 'vi', hint: 'vi' } },
        },
      ],
    }
    const { rerender } = render(<ReviewSession page={page} rows={[]} record={record} />)
    expect(screen.getByRole('heading', { level: 2, name: 'Thẻ' })).toBeTruthy()
    // The server revalidates after every grade (recordOutcome revalidates the current page): the
    // same key's re-render with no cards left must not unmount the section.
    rerender(<ReviewSession page={{ ...page, entries: [], cards: [] }} rows={[]} record={record} />)
    expect(screen.getByRole('heading', { level: 2, name: 'Thẻ' })).toBeTruthy()
  })

  it('never shows "Thẻ" when mounted with no cards, even if a later render adds some', () => {
    const { rerender } = render(
      <ReviewSession
        page={{ ...BASE, entries: [entry('dsa:p1', 'dsa')] }}
        rows={[row('dsa:p1')]}
        record={record}
      />,
    )
    expect(screen.queryByRole('heading', { level: 2, name: 'Thẻ' })).toBeNull()
    rerender(
      <ReviewSession
        page={{
          ...BASE,
          entries: [entry('dsa:p1', 'dsa')],
          cards: [
            {
              itemId: 'english:e1',
              sides: { front: 'x', back: 'y', lang: { front: 'en', back: 'vi', hint: 'vi' } },
            },
          ],
        }}
        rows={[row('dsa:p1')]}
        record={record}
      />,
    )
    expect(screen.queryByRole('heading', { level: 2, name: 'Thẻ' })).toBeNull()
  })

  it('the RF-4 empty state, once mounted showing content, never appears after everything is graded (I3)', () => {
    const page: ReviewPage = { ...BASE, entries: [entry('dsa:p1', 'dsa')] }
    const { rerender } = render(
      <ReviewSession page={page} rows={[row('dsa:p1')]} record={record} />,
    )
    expect(screen.queryByText('Không có bài nào cần ôn hôm nay')).toBeNull()
    rerender(<ReviewSession page={{ ...page, entries: [] }} rows={[]} record={record} />)
    expect(screen.queryByText('Không có bài nào cần ôn hôm nay')).toBeNull()
  })

  it('shows "Bài cần ôn" only while there are rows (a live check, not frozen)', () => {
    const page: ReviewPage = { ...BASE, entries: [entry('dsa:p1', 'dsa')] }
    const { rerender } = render(
      <ReviewSession page={page} rows={[row('dsa:p1')]} record={record} />,
    )
    expect(screen.getByRole('heading', { level: 2, name: 'Bài cần ôn' })).toBeTruthy()
    rerender(<ReviewSession page={page} rows={[]} record={record} />)
    expect(screen.queryByRole('heading', { level: 2, name: 'Bài cần ôn' })).toBeNull()
  })
})
