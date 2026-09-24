import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { Label } from './label'
import { RadioGroup, RadioGroupItem } from './radio-group'

function Example() {
  const [value, setValue] = useState('light')
  return (
    <RadioGroup aria-label="Giao diện" value={value} onValueChange={setValue}>
      <div className="flex items-center gap-2">
        <RadioGroupItem id="theme-light" value="light" />
        <Label htmlFor="theme-light">Sáng</Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem id="theme-dark" value="dark" />
        <Label htmlFor="theme-dark">Tối</Label>
      </div>
    </RadioGroup>
  )
}

describe('RadioGroup', () => {
  it('is a labelled radiogroup whose items are labelled', () => {
    render(<Example />)
    const group = screen.getByRole('radiogroup', { name: 'Giao diện' })
    const light = screen.getByRole('radio', { name: 'Sáng' })
    expect(group.contains(light)).toBe(true)
    expect(light.getAttribute('aria-checked')).toBe('true')
  })

  it('selects one option at a time on click, keeping selection mutually exclusive', async () => {
    render(<Example />)
    const light = screen.getByRole('radio', { name: 'Sáng' })
    const dark = screen.getByRole('radio', { name: 'Tối' })
    await userEvent.setup().click(dark)
    expect(dark.getAttribute('aria-checked')).toBe('true')
    expect(light.getAttribute('aria-checked')).toBe('false')
  })

  it('moves roving focus between items with the arrow keys', async () => {
    render(<Example />)
    const light = screen.getByRole('radio', { name: 'Sáng' })
    const dark = screen.getByRole('radio', { name: 'Tối' })
    const user = userEvent.setup()
    await user.tab()
    expect(document.activeElement).toBe(light)
    expect(light.getAttribute('tabindex')).toBe('0')
    expect(dark.getAttribute('tabindex')).toBe('-1')
    await user.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(dark)
  })

  it('is 20 px with a transparent 44 px hit area, stacked with gap-3', () => {
    render(<Example />)
    const light = screen.getByRole('radio', { name: 'Sáng' })
    expect(light.className).toContain('size-5')
    expect(light.className).toContain('before:-inset-3')
    expect(screen.getByRole('radiogroup').className).toContain('gap-3')
  })
})
