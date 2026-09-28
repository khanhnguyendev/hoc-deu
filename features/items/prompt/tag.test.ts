import { describe, expect, it } from 'vitest'
import { vi } from '@/lib/i18n/vi'
import { promptTagLabel } from './tag'

describe('promptTagLabel', () => {
  it('names a template tag in Vietnamese, else shows the ID', () => {
    expect(promptTagLabel('mock-interview')).toBe(vi.template.tags['mock-interview'])
    expect(promptTagLabel('no-such-tag')).toBe('no-such-tag')
  })

  it('names a custom prompt’s tag "Mục riêng", never the raw `custom` (task 6.6a)', () => {
    expect(promptTagLabel('custom')).toBe(vi.customItems.promptTag)
    expect(vi.customItems.promptTag).toBe('Mục riêng')
  })
})
