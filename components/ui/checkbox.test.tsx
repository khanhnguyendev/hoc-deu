import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { Checkbox } from './checkbox'
import { Label } from './label'

function Example() {
  const [checked, setChecked] = useState(false)
  return (
    <>
      <Label htmlFor="agree">Đồng ý điều khoản</Label>
      <Checkbox
        id="agree"
        checked={checked}
        onCheckedChange={(value) => setChecked(value === true)}
      />
    </>
  )
}

describe('Checkbox', () => {
  it('is labelled and toggles with the keyboard', async () => {
    render(<Example />)
    const checkbox = screen.getByRole('checkbox', { name: 'Đồng ý điều khoản' })
    expect(checkbox.getAttribute('aria-checked')).toBe('false')
    const user = userEvent.setup()
    await user.tab()
    expect(document.activeElement).toBe(checkbox)
    await user.keyboard(' ')
    expect(checkbox.getAttribute('aria-checked')).toBe('true')
  })

  it('has a 20 px box with a transparent 44 px hit area', () => {
    render(<Checkbox aria-label="Chọn" />)
    const checkbox = screen.getByRole('checkbox', { name: 'Chọn' })
    expect(checkbox.className).toContain('size-5')
    expect(checkbox.className).toContain('before:-inset-3')
  })

  it('carries aria-invalid styling for error state', () => {
    render(<Checkbox aria-label="Chọn" aria-invalid />)
    const checkbox = screen.getByRole('checkbox', { name: 'Chọn' })
    expect(checkbox.getAttribute('aria-invalid')).toBe('true')
    expect(checkbox.className).toContain('aria-invalid:border-danger')
  })
})
