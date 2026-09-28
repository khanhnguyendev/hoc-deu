import { describe, expect, it } from 'vitest'
import { TOPIC_PRACTICE_TAG, EXTRA_WEEK_TAG } from '@/lib/domain/plan/overrides'
import { vi } from '@/lib/i18n/vi'
import { overrides } from './overrides'

function strings(node: unknown, path = 'overrides'): [string, string][] {
  if (typeof node === 'string') return [[path, node]]
  return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
    strings(value, `${path}.${key}`),
  )
}

describe('lib/i18n/strings/overrides.ts', () => {
  it('is vi.overrides', () => {
    expect(vi.overrides).toBe(overrides)
  })

  it('stores every string non-empty, trimmed and in NFC (RF-3)', () => {
    for (const [path, value] of strings(overrides)) {
      expect(value, path).not.toBe('')
      expect(value, path).toBe(value.trim())
      expect(value, path).toBe(value.normalize('NFC'))
    }
  })

  it('says the brief’s words (§2.4, §5.9)', () => {
    expect(overrides.title).toBe('Điều chỉnh lộ trình bởi AI')
    expect(overrides.suspended).toBe('Tạm dừng (đã tắt cá nhân hoá AI)')
    expect(overrides.revoke.action).toBe('Thu hồi')
    expect(overrides.revoke.description).toBe('Thay đổi có hiệu lực từ kế hoạch ngày mai.')
    expect(overrides.kinds.reorder).toBe('Đổi thứ tự các chủ đề sắp tới')
  })

  it('labels both override block tags', () => {
    expect(Object.keys(overrides.blockTags).sort()).toEqual(
      [EXTRA_WEEK_TAG, TOPIC_PRACTICE_TAG].sort(),
    )
  })
})
