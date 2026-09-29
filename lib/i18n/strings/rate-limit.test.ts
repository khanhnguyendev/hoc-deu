import { describe, expect, it } from 'vitest'
import { fill } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'
import { rateLimit } from './rate-limit'

function strings(node: unknown, path = 'rateLimit'): [string, string][] {
  if (typeof node === 'string') return [[path, node]]
  return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
    strings(value, `${path}.${key}`),
  )
}

describe('lib/i18n/strings/rate-limit.ts', () => {
  it('is vi.rateLimit', () => {
    expect(vi.rateLimit).toBe(rateLimit)
  })

  it('stores every string non-empty, trimmed and in NFC (RF-3)', () => {
    for (const [path, value] of strings(rateLimit)) {
      expect(value, path).not.toBe('')
      expect(value, path).toBe(value.trim())
      expect(value, path).toBe(value.normalize('NFC'))
    }
  })

  it('says the brief’s sentences word for word (§2.3, decision 22)', () => {
    expect(rateLimit.tooMany).toBe('Bạn thao tác quá nhanh. Hãy thử lại sau ít phút.')
    expect(rateLimit.admin.memoryWarning).toBe(
      'Giới hạn tần suất đang chạy trong bộ nhớ (chưa cấu hình Upstash)',
    )
  })

  it('fills the fail-open warning', () => {
    expect(fill(rateLimit.admin.failOpen.warning, { count: 3 })).toBe(
      'Giới hạn tần suất đã mở khi lỗi 3 lần trong 7 ngày qua.',
    )
  })

  it('fills its placeholder', () => {
    expect(fill(rateLimit.admin.failOpen.value, { count: 0 })).toBe('0 lần')
    expect(fill(rateLimit.admin.failOpen.value, { count: 12 })).toBe('12 lần')
  })
})
