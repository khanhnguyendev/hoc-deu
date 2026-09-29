import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SwitchField } from './switch-field'

describe('SwitchField', () => {
  it('names the switch by its visible label and reflects `checked`', () => {
    render(<SwitchField id="s" label="Bật bot" checked onCheckedChange={() => {}} />)
    const toggle = screen.getByRole('switch', { name: 'Bật bot' })
    expect(toggle.getAttribute('aria-checked')).toBe('true')
    expect(toggle.getAttribute('aria-describedby')).toBeNull()
    expect(toggle.getAttribute('aria-busy')).toBeNull()
    // The alert region is always there, empty until a save fails.
    expect(screen.getByRole('alert').textContent).toBe('')
  })

  it('an unchecked switch calls onCheckedChange(true) when flipped', async () => {
    const onCheckedChange = vi.fn()
    render(<SwitchField id="s" label="Bật bot" checked={false} onCheckedChange={onCheckedChange} />)
    await userEvent.setup().click(screen.getByRole('switch'))
    expect(onCheckedChange).toHaveBeenCalledExactlyOnceWith(true)
  })

  it('describes the switch by its description', () => {
    render(
      <SwitchField
        id="s"
        label="Chạy thử"
        description="Không ghi gì."
        checked={false}
        onCheckedChange={() => {}}
      />,
    )
    const toggle = screen.getByRole('switch', { name: 'Chạy thử' })
    expect(toggle.getAttribute('aria-describedby')).toBe('s-description')
    expect(document.getElementById('s-description')?.textContent).toBe('Không ghi gì.')
  })

  it('shows an error in the alert region and joins it to the description', () => {
    render(
      <SwitchField
        id="s"
        label="Chạy thử"
        description="Không ghi gì."
        error="Không lưu được."
        checked={false}
        onCheckedChange={() => {}}
      />,
    )
    const toggle = screen.getByRole('switch')
    expect(toggle.getAttribute('aria-describedby')).toBe('s-description s-error')
    expect(screen.getByRole('alert').textContent).toBe('Không lưu được.')
    expect(document.getElementById('s-error')?.getAttribute('data-slot')).toBe('form-field-error')
  })

  it('pending: aria-busy; disabled: not operable', async () => {
    const onCheckedChange = vi.fn()
    const { rerender } = render(
      <SwitchField
        id="s"
        label="Bật bot"
        checked={false}
        pending
        onCheckedChange={onCheckedChange}
      />,
    )
    expect(screen.getByRole('switch').getAttribute('aria-busy')).toBe('true')
    rerender(
      <SwitchField
        id="s"
        label="Bật bot"
        checked={false}
        disabled
        onCheckedChange={onCheckedChange}
      />,
    )
    expect((screen.getByRole('switch') as HTMLButtonElement).disabled).toBe(true)
    await userEvent.setup().click(screen.getByRole('switch'))
    expect(onCheckedChange).not.toHaveBeenCalled()
  })

  it('an aria-label that extends the visible label names the switch', () => {
    render(
      <SwitchField
        id="s"
        label="Cá nhân hoá AI"
        ariaLabel="Cá nhân hoá AI cho Bình"
        checked={false}
        onCheckedChange={() => {}}
      />,
    )
    expect(screen.getByRole('switch', { name: 'Cá nhân hoá AI cho Bình' })).toBeTruthy()
  })
})
