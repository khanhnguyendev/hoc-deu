import { describe, expect, it } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('lets a later conflicting utility win', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })

  it('keeps a token colour and a font size together', () => {
    expect(cn('text-sm', 'text-muted-foreground')).toBe('text-sm text-muted-foreground')
  })

  it('drops falsy values', () => {
    expect(cn('bg-surface', false && 'bg-primary', undefined, null)).toBe('bg-surface')
  })
})
