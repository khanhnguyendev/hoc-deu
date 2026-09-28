import { describe, expect, it } from 'vitest'
import { adminOverview } from './admin-overview'

function strings(node: unknown, path = 'adminOverview'): [string, string][] {
  if (typeof node === 'string') return [[path, node]]
  if (Array.isArray(node)) return node.flatMap((item, i) => strings(item, `${path}[${i}]`))
  return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
    strings(v, `${path}.${k}`),
  )
}

describe('lib/i18n/strings/admin-overview.ts', () => {
  it('stores every string non-empty, trimmed and in NFC', () => {
    const all = strings(adminOverview)
    expect(all.length).toBeGreaterThan(40)
    for (const [path, value] of all) {
      expect(value, path).not.toBe('')
      expect(value, path).toBe(value.trim())
      expect(value, path).toBe(value.normalize('NFC'))
    }
  })

  it('says "chưa có dữ liệu" before the first cron run (decision 26)', () => {
    expect(adminOverview.system.noData).toBe('chưa có dữ liệu')
  })

  it('names how drafts are published: the "Xuất bản" button or a `status` change (§6.6)', () => {
    expect(adminOverview.content.drafts.description).toBe(
      'Xuất bản bằng nút "Xuất bản" (lần chạy bot mở PR) hoặc đổi `status` trong `content/**`.',
    )
  })

  it('tells the 100 MB warning to switch to the incremental backup chain (§2.3, §8.4 item 5)', () => {
    expect(adminOverview.warnings.dbIncremental).toContain('chuỗi gia tăng')
    expect(adminOverview.warnings.dbWarn).toContain('ADR-0031')
  })
})
