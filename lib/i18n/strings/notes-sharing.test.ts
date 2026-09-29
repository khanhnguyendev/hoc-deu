import { describe, expect, it } from 'vitest'
import { vi } from '@/lib/i18n/vi'
import { notesSharing } from './notes-sharing'

function strings(node: unknown, path = 'notesSharing'): [string, string][] {
  if (typeof node === 'string') return [[path, node]]
  return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
    strings(value, `${path}.${key}`),
  )
}

describe('lib/i18n/strings/notes-sharing.ts', () => {
  it('is vi.notesSharing', () => {
    expect(vi.notesSharing).toBe(notesSharing)
  })

  it('stores every string non-empty, trimmed and in NFC (RF-3)', () => {
    for (const [path, value] of strings(notesSharing)) {
      expect(value, path).not.toBe('')
      expect(value, path).toBe(value.trim())
      expect(value, path).toBe(value.normalize('NFC'))
    }
  })

  it('says the brief’s sentences word for word (§4.6)', () => {
    expect(notesSharing.title).toBe('Chia sẻ ghi chú với bot AI')
    expect(notesSharing.description).toBe(
      'Bot AI và người vận hành bot có thể xem ghi chú bạn chia sẻ.',
    )
    expect(notesSharing.errors.aiOff).toBe(
      'Tính năng này chỉ dùng được khi tài khoản bật cá nhân hoá AI.',
    )
  })
})
