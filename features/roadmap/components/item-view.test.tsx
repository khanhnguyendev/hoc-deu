import { act, render, screen } from '@testing-library/react'
import type * as React from 'react'
import { use } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ItemPageFrame } from '@/features/items/components/item-page-frame'
import { outcomeBinding } from '@/features/items/fixtures'
import { vi as strings } from '@/lib/i18n/vi'
import { TODAY_HREF, TRACKS_HREF } from '../view-model'
import { ItemView } from './item-view'

/** A page that suspends on a pending promise — stands in for `ItemBody` (task 5.1c). */
function DeferredPage({ promise }: { promise: Promise<React.ReactNode> }) {
  return <>{use(promise)}</>
}

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

  it('opened from a plan (m-9): the link goes back to /today, "Về Hôm nay"', () => {
    render(
      <ItemView
        backHref={TODAY_HREF}
        trackTitle="DSA"
        page={<ItemPageFrame status="active" title="Two Sum" />}
      />,
    )
    const back = screen.getByRole('link', { name: 'Về Hôm nay' })
    expect(back.getAttribute('href')).toBe('/today')
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

  it('task 5.1c: renders the LoadingState fallback while the page is pending, then the page', async () => {
    let resolve!: (node: React.ReactNode) => void
    const promise = new Promise<React.ReactNode>((res) => {
      resolve = res
    })
    await act(async () => {
      render(
        <ItemView backHref="/t/dsa" trackTitle="DSA" page={<DeferredPage promise={promise} />} />,
      )
    })
    expect(screen.getByRole('status')).toBeTruthy()
    expect(screen.getByText(strings.common.loading)).toBeTruthy()
    expect(screen.queryByRole('heading', { level: 1, name: 'Two Sum' })).toBeNull()

    await act(async () => {
      resolve(<ItemPageFrame status="active" title="Two Sum" />)
    })

    expect(screen.getByRole('heading', { level: 1, name: 'Two Sum' })).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('task 5.2c: the page’s outcome controls render inside it (the binding reaches the Page)', () => {
    render(
      <ItemView
        backHref="/t/dsa"
        trackTitle="DSA"
        page={
          <ItemPageFrame
            status="active"
            title="Two Sum"
            outcome={outcomeBinding(vi.fn(), {
              plan: { blockId: 'b', label: 'Trong kế hoạch hôm nay' },
            })}
          />
        }
      />,
    )
    expect(screen.getByText('Trong kế hoạch hôm nay')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Bỏ qua mục này' })).toBeTruthy()
  })
})

describe('ItemView — a custom item (task 6.6a)', () => {
  it('says "Mục riêng của bạn" for the learner’s own item, and nothing for a repository one', () => {
    const { rerender } = render(
      <ItemView
        backHref="/t/english"
        trackTitle="Tiếng Anh cho môi trường IT"
        custom
        page={<ItemPageFrame status="active" title="on hold" />}
      />,
    )
    expect(screen.getByText(strings.customItems.ownLabel)).toBeTruthy()
    rerender(
      <ItemView
        backHref="/t/english"
        trackTitle="Tiếng Anh cho môi trường IT"
        page={<ItemPageFrame status="active" title="on hold" />}
      />,
    )
    expect(screen.queryByText(strings.customItems.ownLabel)).toBeNull()
  })

  it('an active custom item has no hidden badge or read-only line', () => {
    render(
      <ItemView
        backHref="/t/english"
        trackTitle="Tiếng Anh cho môi trường IT"
        custom
        page={<ItemPageFrame status="active" title="on hold" />}
      />,
    )
    expect(screen.queryByText(strings.customItems.hidden)).toBeNull()
    expect(screen.queryByText(strings.customItems.hiddenReadOnly)).toBeNull()
  })

  it('a hidden custom item says "Đã ẩn" beside the label', () => {
    render(
      <ItemView
        backHref="/t/english"
        trackTitle="Tiếng Anh cho môi trường IT"
        custom
        hidden
        page={<ItemPageFrame status="active" title="on hold" />}
      />,
    )
    const badge = screen.getByText(strings.customItems.hidden)
    // Words with an icon, never colour alone (review item 8).
    expect(badge.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    // One line why the page records nothing.
    expect(screen.getByText(strings.customItems.hiddenReadOnly)).toBeTruthy()
    expect(screen.queryByText(/ngừng/i)).toBeNull()
  })
})
