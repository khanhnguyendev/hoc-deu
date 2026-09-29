import { describe, expect, it } from 'vitest'
import { vi } from '@/lib/i18n/vi'
import { publish } from './publish'

function strings(node: unknown, path = 'publish'): [string, string][] {
  if (typeof node === 'string') return [[path, node]]
  return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
    strings(value, `${path}.${key}`),
  )
}

describe('lib/i18n/strings/publish.ts', () => {
  it('is vi.publish', () => {
    expect(vi.publish).toBe(publish)
  })

  it('stores every string non-empty, trimmed and in NFC (RF-3)', () => {
    for (const [path, value] of strings(publish)) {
      expect(value, path).not.toBe('')
      expect(value, path).toBe(value.trim())
      expect(value, path).toBe(value.normalize('NFC'))
    }
  })

  it('says the brief’s words (§2.4, §6.6, ADR-0040)', () => {
    expect(publish.button).toBe('Xuất bản')
    expect(publish.cancel).toBe('Huỷ')
    expect(publish.pending).toBe('Đang chờ xuất bản')
    expect(publish.requests.title).toBe('Yêu cầu xuất bản')
    expect(publish.badge.testedByBot).toBe('Đã kiểm thử (test do bot viết)')
  })

  it('has three checklist lines per kind (all required)', () => {
    expect(publish.dialog.problem).toHaveLength(3)
    expect(publish.dialog.item).toHaveLength(3)
    // Not every item has an English part: the third check applies only when it does.
    expect(publish.dialog.item[2]).toContain('nếu có')
  })
})
