import { describe, expect, it } from 'vitest'
import { fill } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'
import { today } from './today'

function strings(node: unknown, path = 'today'): [string, string][] {
  if (typeof node === 'string') return [[path, node]]
  return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
    strings(value, `${path}.${key}`),
  )
}

describe('lib/i18n/strings/today.ts', () => {
  it('is vi.today', () => {
    expect(vi.today).toBe(today)
  })

  it('stores every string non-empty, trimmed and in NFC (RF-3)', () => {
    for (const [path, value] of strings(today)) {
      expect(value, path).not.toBe('')
      expect(value, path).toBe(value.trim())
      expect(value, path).toBe(value.normalize('NFC'))
    }
  })

  it('drops the placeholder copy of decision 13 (the dashboard has landed)', () => {
    expect(Object.keys(today)).not.toContain('comingSoonTitle')
    expect(Object.keys(today)).not.toContain('comingSoonBody')
  })

  it('says the spec sentences word for word (§5.2, §5.5, DESIGN_SYSTEM §11, decision 32)', () => {
    expect(today.paused.title).toBe(
      'Lộ trình đang tạm dừng — hoàn thành ít nhất một phần để tiếp tục.',
    )
    expect(today.paused.resume).toBe('Học tiếp hôm nay')
    expect(fill(today.throttle.message, { n: 52 })).toBe(
      'Đang có 52 thẻ cần ôn — tạm giảm thẻ mới.',
    )
    expect(today.resumed).toBe('Bạn đã tiếp tục lộ trình hôm nay — kế hoạch mới có vào ngày mai.')
    expect(fill(today.empty.notStarted.title, { date: '3 tháng 10, 2026' })).toBe(
      'Bắt đầu vào 3 tháng 10, 2026',
    )
    expect(today.empty.noBlocks.title).toBe('Hôm nay không có bài nào')
    expect(today.block.overBudget).toBe('Dài hơn thời gian dự kiến')
  })

  it('labels every block kind, and the practice tags of the default templates', () => {
    expect(today.kind).toEqual({
      review: 'Ôn tập',
      new: 'Bài mới',
      recap: 'Ôn tuần {week}',
      recapFiller: 'Ôn lại',
      practice: 'Luyện tập',
      extra: 'Học thêm',
    })
    expect(Object.keys(today.practice).sort()).toEqual(
      ['exercise', 'mock-interview', 'shadowing', 'weekend-task'].sort(),
    )
    expect(today.practice['mock-interview']).toBe('Mock interview')
  })
})
