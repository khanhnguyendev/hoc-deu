import { describe, expect, it } from 'vitest'
import { withTitle } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'
import { customItems } from './custom-items'

function strings(node: unknown, path = 'customItems'): [string, string][] {
  if (typeof node === 'string') return [[path, node]]
  return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
    strings(value, `${path}.${key}`),
  )
}

describe('lib/i18n/strings/custom-items.ts', () => {
  it('is vi.customItems', () => {
    expect(vi.customItems).toBe(customItems)
  })

  it('stores every string non-empty, trimmed and in NFC (RF-3)', () => {
    for (const [path, value] of strings(customItems)) {
      expect(value, path).not.toBe('')
      expect(value, path).toBe(value.trim())
      expect(value, path).toBe(value.normalize('NFC'))
    }
  })

  it('says the brief’s words (§2.4, §5.9)', () => {
    expect(customItems.tabs.custom).toBe('Mục riêng')
    expect(customItems.hide.action).toBe('Ẩn')
    expect(customItems.hide.description).toBe(
      'Mục này sẽ không xuất hiện trong kế hoạch từ ngày mai.',
    )
    expect(customItems.hidden).toBe('Đã ẩn')
    expect(customItems.ownLabel).toBe('Mục riêng của bạn')
  })

  it('fills the hide button’s name with the item, its visible text first', () => {
    expect(withTitle(customItems.hide.actionLabel, 'on hold')).toBe('Ẩn on hold')
  })
})
