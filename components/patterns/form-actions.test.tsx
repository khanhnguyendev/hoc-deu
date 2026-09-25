import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FormActions } from './form-actions'

describe('FormActions', () => {
  it('keeps an empty alert region mounted, so a later failure is announced', () => {
    render(
      <FormActions error={null}>
        <button type="submit">Lưu</button>
      </FormActions>,
    )
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toBe('')
    expect(screen.getByRole('button', { name: 'Lưu' })).toBeTruthy()
  })

  it('shows the failure as a danger Banner inside the alert region, above the actions', () => {
    render(
      <FormActions error="Không lưu được thay đổi. Bạn thử lại nhé.">
        <button type="submit">Lưu</button>
      </FormActions>,
    )
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toBe('Không lưu được thay đổi. Bạn thử lại nhé.')
    expect(alert.querySelector('[data-slot="banner"]')?.getAttribute('data-tone')).toBe('danger')
    const button = screen.getByRole('button', { name: 'Lưu' })
    expect(alert.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('names the buttons as a group when given a label', () => {
    render(
      <FormActions error={null} label="Thao tác với DSA">
        <button type="button">Tạm dừng</button>
      </FormActions>,
    )
    expect(screen.getByRole('group', { name: 'Thao tác với DSA' }).textContent).toBe('Tạm dừng')
  })

  it('is not a flex item of its own: the region and the actions share one block', () => {
    const { container } = render(
      <FormActions error={null}>
        <button type="submit">Lưu</button>
      </FormActions>,
    )
    const root = container.firstElementChild!
    expect(root.getAttribute('data-slot')).toBe('form-actions')
    expect(root.contains(screen.getByRole('alert'))).toBe(true)
    expect(root.contains(screen.getByRole('button'))).toBe(true)
  })
})
