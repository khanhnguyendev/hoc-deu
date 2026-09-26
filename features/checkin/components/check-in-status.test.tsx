import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CheckInStatus } from './check-in-status'

const EDIT_HREF = '/today?block=2026-09-28%3Adsa%3Anew%3A1'
const LABEL = 'Bài mới · Cấu trúc dữ liệu & Giải thuật'
const HINT = 'Đã bỏ qua — bấm Sửa khi bạn làm xong'
const RULE = 'Sửa sau giờ bắt đầu ngày sẽ tính cho hôm nay; ngày trước vẫn chưa hoàn thành.'

describe('CheckInStatus (DESIGN_SYSTEM §3.3, §9)', () => {
  it('a learner’s check-in: "Đã check-in", the Xong pill (icon + label), minutes and "Sửa"', () => {
    const { container } = render(
      <CheckInStatus
        checkIn={{ status: 'done', minutes: 20, auto: false }}
        editHref={EDIT_HREF}
        blockLabel={LABEL}
      />,
    )
    const row = container.querySelector('[data-slot="check-in-status"]')!
    expect(row.textContent).toContain('Đã check-in')
    const pill = row.querySelector('[data-status="block-done"]')!
    expect(pill.textContent).toBe('Xong')
    // Never colour alone: the pill carries its icon.
    expect(pill.querySelector('svg')).not.toBeNull()
    expect(row.textContent).toContain('20 phút')
    expect(row.textContent).not.toContain('tự động')
    const edit = screen.getByRole('link', { name: `Sửa ${LABEL}` })
    expect(edit.getAttribute('href')).toBe(EDIT_HREF)
  })

  it('an auto check-in says "tự động"; Một phần and Bỏ qua have their own pills', () => {
    const { container, rerender } = render(
      <CheckInStatus
        checkIn={{ status: 'partial', minutes: 25, auto: true }}
        editHref={EDIT_HREF}
        blockLabel={LABEL}
      />,
    )
    expect(container.textContent).toContain('tự động')
    expect(container.querySelector('[data-status="block-partial"]')?.textContent).toBe('Một phần')
    rerender(
      <CheckInStatus
        checkIn={{ status: 'skipped', minutes: 0, auto: false }}
        editHref={EDIT_HREF}
        blockLabel={LABEL}
      />,
    )
    expect(container.querySelector('[data-status="block-skipped"]')?.textContent).toBe('Bỏ qua')
    expect(container.textContent).not.toContain('tự động')
    // Outside the paused view a skipped block has no M-6 lines.
    expect(container.textContent).not.toContain(HINT)
  })

  it('the paused view: a skipped block says how to correct it, and the owner’s line (M-6 a)', () => {
    render(
      <CheckInStatus
        checkIn={{ status: 'skipped', minutes: 0, auto: false }}
        editHref={EDIT_HREF}
        blockLabel={LABEL}
        paused
      />,
    )
    expect(screen.getByText(HINT)).toBeTruthy()
    expect(screen.getByText(RULE)).toBeTruthy()
    expect(screen.getByRole('link', { name: `Sửa ${LABEL}` })).toBeTruthy()
  })

  it('the paused view shows the lines only for a skipped block', () => {
    render(
      <CheckInStatus
        checkIn={{ status: 'partial', minutes: 5, auto: false }}
        editHref={EDIT_HREF}
        blockLabel={LABEL}
        paused
      />,
    )
    expect(screen.queryByText(HINT)).toBeNull()
    expect(screen.queryByText(RULE)).toBeNull()
  })
})
