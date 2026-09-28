import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { PublishRequestView } from '../content'
import { PublishRequests } from './publish-requests'

const PR = 'https://github.com/khanhnguyendev/hoc-deu/pull/41'

const row = (overrides: Partial<PublishRequestView> = {}): PublishRequestView => ({
  id: 2,
  target: 'dsa:lc-0206#note',
  title: 'Reverse Linked List',
  titleLang: 'en',
  kind: 'Ghi chú',
  href: '/t/dsa/items/lc-0206',
  status: 'pending',
  statusLabel: 'Đang chờ',
  pr: { href: PR, label: 'PR #41' },
  requestedAt: '09:00, 2 tháng 10, 2026',
  ...overrides,
})

describe('PublishRequests ("Yêu cầu xuất bản", §6.6)', () => {
  it('lists each request: its item (linked, with the target), status, PR and time', () => {
    render(
      <PublishRequests
        requests={{
          state: 'ready',
          rows: [
            row(),
            row({
              id: 1,
              target: 'dsa:lc-4242',
              title: 'dsa:lc-4242',
              titleLang: undefined,
              kind: null,
              href: null,
              status: 'cancelled',
              statusLabel: 'Đã huỷ',
              pr: null,
            }),
          ],
        }}
      />,
    )
    const table = screen.getByRole('table')
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['Mục', 'Trạng thái', 'Pull request', 'Yêu cầu lúc'])
    const [, first, second] = within(table).getAllByRole('row')
    const link = within(first!).getByRole('link', { name: /Reverse Linked List/ })
    expect(link.getAttribute('href')).toBe('/t/dsa/items/lc-0206')
    expect(within(link).getByText('Reverse Linked List').getAttribute('lang')).toBe('en')
    // 44 px targets: the md button height, not sm.
    expect(link.className).toContain('h-11')
    expect(link.className).not.toContain('h-9')
    expect(first!.textContent).toContain('dsa:lc-0206#note')
    expect(first!.textContent).toContain('Đang chờ')
    expect(
      within(first!)
        .getByRole('link', { name: /PR #41/ })
        .getAttribute('href'),
    ).toBe(PR)
    expect(first!.textContent).toContain('09:00, 2 tháng 10, 2026')
    // Status is words with an icon, never colour alone.
    expect(first!.querySelector('[data-status="pending"] svg')).not.toBeNull()
    // A target the catalog no longer has: plain text, no link, "—" for the PR.
    expect(within(second!).queryByRole('link')).toBeNull()
    expect(second!.textContent).toContain('dsa:lc-4242')
    expect(second!.textContent).toContain('—')
  })

  it('empty: says there is no request yet and how to make one', () => {
    render(<PublishRequests requests={{ state: 'empty' }} />)
    expect(
      screen.getByRole('heading', { level: 3, name: 'Chưa có yêu cầu xuất bản nào' }),
    ).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('error: an alert, the rest of the page unaffected', () => {
    render(<PublishRequests requests={{ state: 'error' }} />)
    expect(screen.getByRole('alert').textContent).toContain('Không đọc được yêu cầu xuất bản')
  })
})
