import { describe, expect, it } from 'vitest'
import { fill } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'
import { adminBot } from './admin-bot'

function strings(node: unknown, path = 'adminBot'): [string, string][] {
  if (typeof node === 'string') return [[path, node]]
  return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
    strings(value, `${path}.${key}`),
  )
}

describe('lib/i18n/strings/admin-bot.ts', () => {
  it('is vi.adminBot', () => {
    expect(vi.adminBot).toBe(adminBot)
  })

  it('stores every string non-empty, trimmed and in NFC (RF-3)', () => {
    for (const [path, value] of strings(adminBot)) {
      expect(value, path).not.toBe('')
      expect(value, path).toBe(value.trim())
      expect(value, path).toBe(value.normalize('NFC'))
    }
  })

  it('says the brief’s words verbatim (task 6.3, §2.4)', () => {
    expect(adminBot.nav).toBe('Bot AI')
    expect(adminBot.apiDisabled.startsWith('Chưa bật API bot')).toBe(true)
    expect(adminBot.controls.enabled.label).toBe('Bật bot')
    expect(adminBot.controls.dryRun.label).toBe('Chạy thử (dry-run)')
    expect(adminBot.controls.contentProposals.label).toBe('Đề xuất nội dung')
    expect(adminBot.token.none).toBe('Chưa có token')
    expect(adminBot.token.rotate).toBe('Tạo token mới')
    expect(adminBot.token.shownOnce).toBe('Token chỉ hiện một lần')
  })

  it('fills its placeholders', () => {
    const at = fill(adminBot.at, { time: '10:00', day: '28 tháng 9, 2026' })
    expect(at).toBe('10:00, 28 tháng 9, 2026')
    expect(fill(adminBot.token.current, { time: at })).toBe(
      'Token hiện tại tạo lúc 10:00, 28 tháng 9, 2026',
    )
    expect(fill(adminBot.token.previous, { time: at })).toBe(
      'Token cũ còn dùng được đến 10:00, 28 tháng 9, 2026',
    )
    expect(fill(adminBot.controls.cap.description, { max: 100 })).toBe(
      'Từ 1 đến 100 (giới hạn cứng).',
    )
  })
})
