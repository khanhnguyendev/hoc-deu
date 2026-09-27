import { describe, expect, it } from 'vitest'
import { fill } from '@/lib/i18n/format'
import { CHECK_IN_STATUSES } from '@/lib/domain/state'
import { vi } from '../vi'
import { checkIn } from './check-in'

/** Every string of `node`, with its path. */
function strings(node: unknown, path = 'checkIn'): [string, string][] {
  if (typeof node === 'string') return [[path, node]]
  return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
    strings(value, `${path}.${key}`),
  )
}

describe('lib/i18n/strings/check-in.ts (tasks 5.2a, 5.2b)', () => {
  it('is vi.checkIn', () => {
    expect(vi.checkIn).toBe(checkIn)
  })

  it.each(strings(checkIn))('%s is trimmed, non-empty NFC text', (_path, text) => {
    expect(text.length).toBeGreaterThan(0)
    expect(text).toBe(text.trim())
    expect(text).toBe(text.normalize('NFC'))
  })

  it('answers every check-in status', () => {
    expect(Object.keys(checkIn.checkedIn).sort()).toEqual([...CHECK_IN_STATUSES].sort())
  })

  it('has the write path messages of the brief (RF-3, decision 13)', () => {
    expect(checkIn.errors.noteTooLong).toMatch(/^Ghi chú quá dài/)
    expect(checkIn.errors.noteTooLong).toContain('280')
    // UI I-3: the one "page refreshed" message, true when it is read — the action revalidated.
    expect(checkIn.errors.stale).toBe('Kế hoạch vừa thay đổi. Trang đã được làm mới.')
    expect(checkIn.outcome.saved).toBe('Đã lưu kết quả.')
    expect(checkIn.outcome.savedAutoCheckInFailed).toBe('Đã lưu kết quả; chưa tự check-in được.')
  })

  it('says the check-in UI’s sentences word for word (DESIGN_SYSTEM §9, §11; M-6 a)', () => {
    // Buttons are verbs; the one-tap button reads "Check-in" (technical term, English).
    expect(checkIn.oneTap).toBe('Check-in')
    expect(checkIn.status.edit).toBe('Sửa')
    expect(checkIn.status.skippedHint).toBe('Đã bỏ qua — bấm Sửa khi bạn làm xong')
    // The owner's line (ruling M-6 a, 2026-09-26).
    expect(checkIn.status.skippedRule).toBe(
      'Sửa sau giờ bắt đầu ngày sẽ tính cho hôm nay; ngày trước vẫn chưa hoàn thành.',
    )
    expect(fill(checkIn.sheet.noteCount, { n: 281, max: 280 })).toBe('281/280')
    expect(fill(checkIn.blockLabel, { kind: 'Bài mới', track: 'Tiếng Anh' })).toBe(
      'Bài mới · Tiếng Anh',
    )
  })
})
