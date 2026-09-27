import { describe, expect, it } from 'vitest'
import { review } from './review'

function strings(node: unknown, path = 'review'): [string, string][] {
  if (typeof node === 'string') return [[path, node]]
  if (Array.isArray(node)) return node.flatMap((item, i) => strings(item, `${path}[${i}]`))
  return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
    strings(v, `${path}.${k}`),
  )
}

describe('lib/i18n/strings/review.ts', () => {
  it('stores every string non-empty, trimmed and in NFC', () => {
    const all = strings(review)
    expect(all.length).toBeGreaterThan(0)
    for (const [path, value] of all) {
      expect(value, path).not.toBe('')
      expect(value, path).toBe(value.trim())
      expect(value, path).toBe(value.normalize('NFC'))
    }
  })

  it('names the empty state exactly as RF-4 requires', () => {
    // m-6: "mục" for any item, "thẻ" only for cards — as the header's "{n} mục cần ôn hôm nay".
    expect(review.emptyTitle).toBe('Không có mục nào cần ôn hôm nay')
    expect(review.itemsTitle).toBe('Mục cần ôn')
    expect(review.emptyFilteredTitle).toBe('Lộ trình này không có mục nào cần ôn hôm nay')
  })
})
