import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { botRunLog, type AdminBotRun } from '../bot'
import { BotRunLog } from './bot-run-log'

const RUN: AdminBotRun = {
  runKey: 'run_2026-09-28',
  kind: 'plan',
  mode: 'dry_run',
  status: 'completed',
  failureReason: null,
  usersEligible: 14,
  usersDeferred: 3,
  outcomes: { applied: 2, dry_run: 4, skipped_gate_closed: 2, skipped_unseen: 1, invalid: 1 },
  contentPrUrl: 'https://github.com/khanhnguyendev/hoc-deu/pull/41',
  summary: '10 users: 7 plans; PR #41',
  startedAt: '2026-09-27T22:30:00Z',
  finishedAt: '2026-09-27T23:10:00Z',
}
const FAILED: AdminBotRun = {
  ...RUN,
  runKey: 'run_2026-09-27',
  mode: 'live',
  status: 'failed',
  failureReason: 'timeout',
  usersDeferred: 0,
  outcomes: { pending: 5 },
  contentPrUrl: null,
  summary: null,
  startedAt: '2026-09-26T22:30:00Z',
}
const WARNING =
  '3 người dùng AI không được xử lý hôm nay — tăng giới hạn hoặc giảm số người dùng AI.'

const cells = (row: HTMLElement) =>
  within(row)
    .getAllByRole('cell')
    .map((cell) => cell.textContent)

describe('BotRunLog (task 6.4a, §6.2)', () => {
  it('lists each run: date and start, kind, mode, status and reason, the counts and the PR', () => {
    render(<BotRunLog log={botRunLog([RUN, FAILED])} />)
    const table = screen.getByRole('region', { name: 'Các lần chạy gần nhất của bot' })
    expect(table.getAttribute('tabindex')).toBe('0')
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual([
      'Lần chạy',
      'Loại',
      'Chế độ',
      'Trạng thái',
      'Đủ điều kiện',
      'Đang chờ',
      'Đã áp dụng',
      'Chạy thử',
      'Bỏ qua',
      'Không hợp lệ',
      'Lỗi',
      'Để lại',
      'Pull request',
      'Tóm tắt',
    ])
    const [first, second] = within(table).getAllByRole('row').slice(1) as [HTMLElement, HTMLElement]
    expect(within(first).getByRole('rowheader').textContent).toBe('28 tháng 9, 2026bắt đầu 05:30')
    expect(cells(first)).toEqual([
      'Kế hoạch',
      'Chạy thử',
      'Hoàn tất',
      '14',
      '0',
      '2',
      '4',
      '3',
      '1',
      '0',
      '3',
      'PR #41 (mở trong tab mới)',
      '10 users: 7 plans; PR #41',
    ])
    const link = within(first).getByRole('link', { name: /PR #41/ })
    expect(link.getAttribute('href')).toBe('https://github.com/khanhnguyendev/hoc-deu/pull/41')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')

    expect(cells(second).slice(0, 5)).toEqual([
      'Kế hoạch',
      'Chạy thật',
      'Thất bại (quá 2 giờ)',
      '14',
      '5',
    ])
    expect(cells(second).slice(-2)).toEqual(['—', '—'])
    // Status is never colour alone: each carries its icon and its words.
    expect(
      within(second)
        .getByText('Thất bại (quá 2 giờ)')
        .closest('[data-status]')
        ?.getAttribute('data-status'),
    ).toBe('failed')
  })

  it('shows the deferred-users warning above the log, and nothing when there is none', () => {
    const { container, rerender } = render(
      <BotRunLog log={botRunLog([RUN])} deferredWarning={WARNING} />,
    )
    const banner = container.querySelector('[data-slot="banner"]')
    if (banner === null) throw new Error('no banner')
    expect(banner.textContent).toBe(WARNING)
    expect(banner.getAttribute('data-tone')).toBe('warning')
    const order = banner.compareDocumentPosition(screen.getByRole('table'))
    expect(order & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    rerender(<BotRunLog log={botRunLog([RUN])} deferredWarning={null} />)
    expect(container.querySelector('[data-slot="banner"]')).toBeNull()
  })

  it('empty: "Chưa có lần chạy nào"', () => {
    render(<BotRunLog log={botRunLog([])} />)
    expect(screen.getByRole('heading', { name: 'Chưa có lần chạy nào' })).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('error: an alert that the log could not be read (the controls stay usable)', () => {
    render(<BotRunLog log={botRunLog(null)} />)
    const alert = screen.getByRole('alert')
    expect(within(alert).getByRole('heading', { name: 'Không đọc được nhật ký chạy' })).toBeTruthy()
    expect(alert.textContent).toContain('Các điều khiển vẫn dùng được.')
    expect(screen.queryByRole('table')).toBeNull()
  })
})
