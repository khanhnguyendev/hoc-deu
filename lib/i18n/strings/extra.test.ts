import { describe, expect, it } from 'vitest'
import { fill } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'
import { extra } from './extra'

function strings(node: unknown, path = 'extra'): [string, string][] {
  if (typeof node === 'string') return [[path, node]]
  return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
    strings(value, `${path}.${key}`),
  )
}

describe('lib/i18n/strings/extra.ts', () => {
  it('is vi.extra', () => {
    expect(vi.extra).toBe(extra)
  })

  it('stores every string non-empty, trimmed and in NFC (RF-3)', () => {
    for (const [path, value] of strings(extra)) {
      expect(value, path).not.toBe('')
      expect(value, path).toBe(value.trim())
      expect(value, path).toBe(value.normalize('NFC'))
    }
  })

  it('says the brief’s sentences word for word (decision 20, §5.9; the throttle line: M5-R33)', () => {
    expect(extra.add.action).toBe('Học thêm')
    // UI I-5: the throttle banner says why, once; the card says only that new items wait.
    expect(extra.add.newPaused).toBe('Hôm nay tạm dừng bài mới.')
    expect(extra.add.nothingToAdd).toBe('Bạn đã học hết bài mới của lộ trình này.')
    // m-6: Weak items are "mục" — cards among them too.
    expect(extra.weak.title).toBe('Mục yếu')
    expect(extra.weak.empty).toBe('Chưa có mục yếu nào trong lộ trình này.')
    expect(extra.reset.action).toBe('Bắt đầu lại')
    expect(`${extra.reset.title} ${extra.reset.description}`).toBe(
      'Xoá tiến độ của lộ trình này? Lịch sử học và chuỗi ngày vẫn được giữ.',
    )
  })

  it('fills its placeholders', () => {
    expect(fill(extra.progress.core, { introduced: 20, total: 64 })).toBe('20/64 bài chính đã học')
    expect(fill(extra.reset.done, { title: 'DSA' })).toBe('Đã bắt đầu lại lộ trình DSA.')
  })
})
