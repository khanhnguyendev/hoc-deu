import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Callout } from './callout'

describe('Callout', () => {
  it.each([
    ['info', 'Lưu ý', 'bg-primary-soft'],
    ['tip', 'Mẹo', 'bg-success-soft'],
    ['warning', 'Cẩn thận', 'bg-warning-soft'],
  ] as const)('%s: a note with an icon, the label "%s" and %s', (tone, label, background) => {
    render(
      <Callout tone={tone}>
        <p>Nội dung.</p>
      </Callout>,
    )
    const note = screen.getByRole('note')
    expect(note.className).toContain(background)
    expect(note.textContent).toContain(label)
    expect(note.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(note?.contains(screen.getByText('Nội dung.'))).toBe(true)
  })

  it('uses the title instead of the tone label', () => {
    render(
      <Callout tone="tip" title="Dấu hiệu">
        x
      </Callout>,
    )
    const note = screen.getByRole('note')
    expect(note.textContent).toContain('Dấu hiệu')
    expect(note.textContent).not.toContain('Mẹo')
  })

  it('falls back to info for an unknown tone, never Object.prototype', () => {
    render(<Callout tone={'constructor' as 'info'}>x</Callout>)
    const note = screen.getByRole('note')
    expect(note.textContent).toContain('Lưu ý')
    expect(note.className).toContain('bg-primary-soft')
  })
})
