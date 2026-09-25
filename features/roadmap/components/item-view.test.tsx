import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ItemPageFrame } from '@/features/items/components/item-page-frame'
import { TRACKS_HREF } from '../view-model'
import { ItemView } from './item-view'

describe('ItemView', () => {
  it('links back to the track by name, then renders the item page', () => {
    render(
      <ItemView
        backHref="/t/dsa"
        trackTitle="Cấu trúc dữ liệu & Giải thuật"
        page={<ItemPageFrame status="active" title="Two Sum" />}
      />,
    )
    const back = screen.getByRole('link', { name: 'Về lộ trình Cấu trúc dữ liệu & Giải thuật' })
    expect(back.getAttribute('href')).toBe('/t/dsa')
    expect(screen.getByRole('heading', { level: 1, name: 'Two Sum' })).toBeTruthy()
  })

  it('names the track list when the link goes there (a retired track the learner left)', () => {
    render(
      <ItemView
        backHref={TRACKS_HREF}
        trackTitle="Lộ trình cũ"
        page={<ItemPageFrame status="active" title="Drill" />}
      />,
    )
    const back = screen.getByRole('link', { name: 'Về danh sách lộ trình' })
    expect(back.getAttribute('href')).toBe('/tracks')
  })

  it('M3-R4: adds no notice of its own — the page’s ItemPageFrame shows it exactly once', () => {
    render(
      <ItemView
        backHref="/t/dsa"
        trackTitle="DSA"
        page={<ItemPageFrame status="retired" title="3Sum" />}
      />,
    )
    expect(
      screen.getAllByText('Mục này đã ngừng: không còn được xếp vào kế hoạch học.'),
    ).toHaveLength(1)
  })

  it('M3-R4: a draft page likewise shows one notice', () => {
    render(
      <ItemView
        backHref="/t/dsa"
        trackTitle="DSA"
        page={<ItemPageFrame status="draft" title="Contains Duplicate" />}
      />,
    )
    expect(screen.getAllByText('Bản nháp: chỉ quản trị viên thấy mục này.')).toHaveLength(1)
  })
})
