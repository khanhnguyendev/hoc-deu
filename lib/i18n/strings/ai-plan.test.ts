import { describe, expect, it } from 'vitest'
import { vi } from '@/lib/i18n/vi'
import { aiPlan } from './ai-plan'

describe('lib/i18n/strings/ai-plan.ts', () => {
  it('is vi.aiPlan', () => {
    expect(vi.aiPlan).toBe(aiPlan)
  })

  it('stores every string non-empty, trimmed and in NFC', () => {
    for (const [key, value] of Object.entries(aiPlan)) {
      expect(value, key).not.toBe('')
      expect(value, key).toBe(value.trim())
      expect(value, key).toBe(value.normalize('NFC'))
    }
  })

  it('says the mode badge word for word (§2.4, decision 16)', () => {
    expect(aiPlan.badge).toBe('Cá nhân hoá bởi AI')
  })
})
