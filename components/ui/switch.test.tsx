import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { Label } from './label'
import { Switch } from './switch'

function Example() {
  const [checked, setChecked] = useState(false)
  return (
    <>
      <Label htmlFor="share">Chia sẻ</Label>
      <Switch id="share" checked={checked} onCheckedChange={setChecked} />
    </>
  )
}

describe('Switch', () => {
  it('is labelled and toggles with the keyboard', async () => {
    render(<Example />)
    const toggle = screen.getByRole('switch', { name: 'Chia sẻ' })
    expect(toggle.getAttribute('aria-checked')).toBe('false')
    const user = userEvent.setup()
    await user.tab()
    expect(document.activeElement).toBe(toggle)
    await user.keyboard(' ')
    expect(toggle.getAttribute('aria-checked')).toBe('true')
  })

  it('is a 44×24 px control with a transparent hit area of at least 44 px', () => {
    render(<Switch aria-label="Bật" />)
    const toggle = screen.getByRole('switch', { name: 'Bật' })
    expect(toggle.className).toContain('h-6')
    expect(toggle.className).toContain('w-11')
    expect(toggle.className).toContain('before:-inset-y-2.5')
  })

  it('disables and can be marked checked without a click', () => {
    render(<Switch aria-label="Bật" checked disabled onCheckedChange={() => {}} />)
    const toggle = screen.getByRole('switch', { name: 'Bật' })
    expect(toggle.getAttribute('aria-checked')).toBe('true')
    expect(toggle).toHaveProperty('disabled', true)
  })
})
