import { describe, expect, it } from 'vitest'
import { progress } from './progress'

function strings(node: unknown, path = 'progress'): [string, string][] {
  if (typeof node === 'string') return [[path, node]]
  if (Array.isArray(node)) return node.flatMap((item, i) => strings(item, `${path}[${i}]`))
  return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
    strings(v, `${path}.${k}`),
  )
}

describe('lib/i18n/strings/progress.ts', () => {
  it('stores every string non-empty, trimmed and in NFC', () => {
    for (const [path, value] of strings(progress)) {
      expect(value, path).not.toBe('')
      expect(value, path).toBe(value.trim())
      expect(value, path).toBe(value.normalize('NFC'))
    }
  })

  it('names the empty state exactly as RF-4 requires', () => {
    expect(progress.emptyTitle).toBe('Chưa có ngày học nào — bắt đầu từ trang Hôm nay')
  })
})
