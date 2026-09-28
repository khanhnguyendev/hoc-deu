import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AdminActionResult } from '../actions'
import type { Drafts } from '../content'
import { DraftsList } from './drafts-list'

vi.mock('@/components/ui/toaster', () => ({ toast: vi.fn() }))

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

describe('DraftsList — publishing (§6.6, task 6.7a)', () => {
  const done = async (): Promise<AdminActionResult> => ({ ok: true, message: 'ok' })
  const PUBLISHABLE: Drafts = {
    tracks: DRAFTS.tracks,
    items: [
      {
        ...DRAFTS.items[0]!,
        target: 'dsa:lc-0146',
        checklist: 'problem',
        verification: null,
        request: null,
      },
      {
        ...DRAFTS.items[1]!,
        target: 'dsa:lesson-linked-list',
        checklist: 'item',
        verification: null,
        request: { requestId: 7, pr: null },
      },
    ],
    notes: [
      {
        ...DRAFTS.notes[0]!,
        target: 'dsa:lc-0206#note',
        checklist: 'problem',
        verification: 'tested-by-bot',
        request: {
          requestId: 8,
          pr: { href: 'https://github.com/khanhnguyendev/hoc-deu/pull/41', label: 'PR #41' },
        },
      },
    ],
  }

  it('gives each draft item and note its "Xuất bản" or its pending state; tracks none', () => {
    render(<DraftsList drafts={PUBLISHABLE} requestPublish={done} cancelPublish={done} />)
    expect(screen.getByRole('button', { name: 'Xuất bản LRU Cache' })).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Huỷ yêu cầu xuất bản Danh sách liên kết' }),
    ).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Huỷ yêu cầu xuất bản Reverse Linked List' }),
    ).toBeTruthy()
    expect(screen.getAllByText('Đang chờ xuất bản')).toHaveLength(2)
    expect(screen.getByRole('link', { name: /PR #41/ })).toBeTruthy()
    // A draft track is not a publish target.
    const track = screen.getByRole('link', { name: /Thiết kế hệ thống/ }).closest('li')!
    expect(within(track).queryByRole('button')).toBeNull()
    // The controls sit beside the row's link, never inside it.
    for (const link of screen.getAllByRole('link')) {
      expect(within(link).queryByRole('button')).toBeNull()
    }
  })

  it('a bot-written draft note reads "Đã kiểm thử (test do bot viết)" (ADR-0040)', () => {
    render(<DraftsList drafts={PUBLISHABLE} requestPublish={done} cancelPublish={done} />)
    const note = screen.getByRole('link', { name: /Reverse Linked List/ })
    const badge = note.querySelector('[data-slot="draft-verification"]')
    expect(badge?.getAttribute('data-verification')).toBe('tested-by-bot')
    expect(badge?.textContent).toBe('Đã kiểm thử (test do bot viết)')
    expect(badge?.querySelector('svg')).not.toBeNull()
  })

  it('a human-written note keeps "Đã kiểm thử" or "Chỉ biên dịch"', () => {
    const notes = (verification: 'tested' | 'compile-only') => ({
      ...PUBLISHABLE,
      notes: [{ ...PUBLISHABLE.notes[0]!, verification }],
    })
    const { unmount } = render(<DraftsList drafts={notes('tested')} />)
    expect(document.querySelector('[data-slot="draft-verification"]')?.textContent).toBe(
      'Đã kiểm thử',
    )
    unmount()
    render(<DraftsList drafts={notes('compile-only')} />)
    expect(document.querySelector('[data-slot="draft-verification"]')?.textContent).toBe(
      'Chỉ biên dịch',
    )
  })

  it('without the actions (the catalog) a draft shows its state, no button', () => {
    render(<DraftsList drafts={PUBLISHABLE} />)
    expect(screen.queryByRole('button', { name: /^Xuất bản/ })).toBeNull()
    expect(screen.getAllByText('Đang chờ xuất bản')).toHaveLength(2)
  })
})
