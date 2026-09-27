import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Drafts } from '../content'
import { DraftsList } from './drafts-list'

const DRAFTS: Drafts = {
  tracks: [{ id: 'system-design', title: 'Thiết kế hệ thống', href: '/t/system-design' }],
  items: [
    {
      id: 'dsa:lc-0146',
      title: 'LRU Cache',
      titleLang: 'en',
      meta: ['Cấu trúc dữ liệu & Giải thuật', 'Problem'],
      href: '/t/dsa/items/lc-0146',
    },
    {
      id: 'dsa:lesson-linked-list',
      title: 'Danh sách liên kết',
      titleLang: undefined,
      meta: ['Cấu trúc dữ liệu & Giải thuật', 'Lesson'],
      href: '/t/dsa/items/lesson-linked-list',
    },
  ],
  notes: [
    {
      id: 'dsa:lc-0206#note',
      title: 'Reverse Linked List',
      titleLang: 'en',
      meta: ['Cấu trúc dữ liệu & Giải thuật', 'Ghi chú'],
      href: '/t/dsa/items/lc-0206',
    },
  ],
}

const EMPTY: Drafts = { tracks: [], items: [], notes: [] }

describe('DraftsList', () => {
  it('says how v1.0 publishes a draft: a status change in content/** ("Xuất bản" is v1.1)', () => {
    const { container } = render(<DraftsList drafts={EMPTY} />)
    const note = container.querySelector('[data-slot="drafts-list"] > p')
    expect(note?.textContent).toBe(
      'v1.0: xuất bản bằng một thay đổi status trong content/** (nút "Xuất bản" có từ v1.1).',
    )
    expect([...(note?.querySelectorAll('code') ?? [])].map((code) => code.textContent)).toEqual([
      'status',
      'content/**',
    ])
    expect(screen.queryByRole('button', { name: 'Xuất bản' })).toBeNull()
  })

  it('shows an EmptyState when nothing is a draft', () => {
    render(<DraftsList drafts={EMPTY} />)
    expect(screen.getByRole('heading', { level: 3, name: 'Không có bản nháp nào.' })).toBeTruthy()
    expect(screen.queryByRole('list')).toBeNull()
  })

  it('groups draft tracks, items and notes with their counts, each entry a link', () => {
    render(<DraftsList drafts={DRAFTS} />)
    expect(
      screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent),
    ).toEqual(['Lộ trình nháp (1)', 'Mục nháp (2)', 'Ghi chú nháp (1)'])
    const lru = screen.getByRole('link', { name: /LRU Cache/ })
    expect(lru.getAttribute('href')).toBe('/t/dsa/items/lc-0146')
    expect(lru.textContent).toContain('Problem')
    expect(within(lru).getByText('LRU Cache').getAttribute('lang')).toBe('en')
    expect(screen.getByRole('link', { name: /Thiết kế hệ thống/ }).getAttribute('href')).toBe(
      '/t/system-design',
    )
    expect(screen.getByRole('link', { name: /Reverse Linked List/ }).textContent).toContain(
      'Ghi chú',
    )
  })

  it('leaves out an empty group', () => {
    render(<DraftsList drafts={{ ...EMPTY, notes: DRAFTS.notes }} />)
    expect(
      screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent),
    ).toEqual(['Ghi chú nháp (1)'])
  })
})
