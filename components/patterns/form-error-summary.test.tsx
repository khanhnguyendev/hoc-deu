import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FormErrorSummary } from './form-error-summary'

describe('FormErrorSummary', () => {
  it('renders nothing when there are no errors', () => {
    const { container } = render(
      <FormErrorSummary title="Vui lòng kiểm tra lại các mục sau" errors={[]} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('is an alert, focused, with a link to each field', () => {
    render(
      <FormErrorSummary
        title="Vui lòng kiểm tra lại các mục sau"
        errors={[
          { fieldId: 'email', message: 'Email chưa đúng định dạng.' },
          { fieldId: 'minutes', message: 'Chọn số phút hợp lệ.' },
        ]}
      />,
    )
    const alert = screen.getByRole('alert')
    expect(document.activeElement).toBe(alert)
    expect(alert.textContent).toContain('Vui lòng kiểm tra lại các mục sau')
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(2)
    expect(links[0]?.getAttribute('href')).toBe('#email')
    expect(links[1]?.getAttribute('href')).toBe('#minutes')
  })

  it('only refocuses when the error content changes, not on every new array reference', () => {
    const { rerender } = render(
      <>
        <FormErrorSummary
          title="Vui lòng kiểm tra lại các mục sau"
          errors={[{ fieldId: 'email', message: 'Email chưa đúng định dạng.' }]}
        />
        <input aria-label="Khác" />
      </>,
    )
    const alert = screen.getByRole('alert')
    expect(document.activeElement).toBe(alert)

    // Move focus elsewhere, as a user editing another field would.
    const other = screen.getByLabelText('Khác')
    other.focus()
    expect(document.activeElement).toBe(other)

    // A re-render with a brand-new array of the *same* content (e.g. re-derived on every
    // keystroke) must not steal focus back.
    rerender(
      <>
        <FormErrorSummary
          title="Vui lòng kiểm tra lại các mục sau"
          errors={[{ fieldId: 'email', message: 'Email chưa đúng định dạng.' }]}
        />
        <input aria-label="Khác" />
      </>,
    )
    expect(document.activeElement).toBe(other)

    // A re-render whose error *content* actually changed does move focus back.
    rerender(
      <>
        <FormErrorSummary
          title="Vui lòng kiểm tra lại các mục sau"
          errors={[{ fieldId: 'email', message: 'Email là bắt buộc.' }]}
        />
        <input aria-label="Khác" />
      </>,
    )
    expect(document.activeElement).toBe(screen.getByRole('alert'))
  })
})
