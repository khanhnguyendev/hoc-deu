import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Input } from './input'
import { Label } from './label'
import { Textarea } from './textarea'

describe('Input, Textarea and Label', () => {
  it('labels an input and accepts typing', async () => {
    render(
      <>
        <Label htmlFor="minutes">Số phút mỗi ngày</Label>
        <Input id="minutes" inputMode="numeric" />
      </>,
    )
    const input = screen.getByLabelText('Số phút mỗi ngày')
    await userEvent.setup().type(input, '60')
    expect(input).toHaveProperty('value', '60')
    expect(input.className).toContain('h-11')
    expect(input.className).toContain('border-border-strong')
  })

  it('labels a textarea', () => {
    render(
      <>
        <Label htmlFor="note">Ghi chú</Label>
        <Textarea id="note" />
      </>,
    )
    expect(screen.getByLabelText('Ghi chú').tagName).toBe('TEXTAREA')
  })

  it('passes aria-invalid through for error styling', () => {
    render(<Input aria-label="Email" aria-invalid />)
    const input = screen.getByLabelText('Email')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(input.className).toContain('aria-invalid:border-danger')
  })

  it('never removes the focus outline', () => {
    render(
      <>
        <Input aria-label="A" />
        <Textarea aria-label="B" />
      </>,
    )
    for (const name of ['A', 'B']) {
      expect(screen.getByLabelText(name).className).not.toMatch(/outline-none|outline-hidden/)
    }
  })
})
