import { describe, expect, it } from 'vitest'
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
    expect(checkIn.errors.stale).toBe('Kế hoạch đã thay đổi — tải lại trang.')
    expect(checkIn.outcome.saved).toBe('Đã lưu kết quả.')
    expect(checkIn.outcome.savedAutoCheckInFailed).toBe('Đã lưu kết quả; chưa tự check-in được.')
  })
})
