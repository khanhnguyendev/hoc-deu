import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
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

  it('re-focuses and re-announces on a repeated identical error when submitCount changes (M2 minor)', () => {
    const errors = [{ fieldId: 'email', message: 'Email chưa đúng định dạng.' }]
    const { rerender } = render(
      <>
        <FormErrorSummary
          title="Vui lòng kiểm tra lại các mục sau"
          errors={errors}
          submitCount={1}
        />
        <input aria-label="Khác" />
      </>,
    )
    screen.getByLabelText('Khác').focus()
    expect(document.activeElement).toBe(screen.getByLabelText('Khác'))

    // The exact same error content, but a new submission (submitCount): refocus anyway.
    rerender(
      <>
        <FormErrorSummary
          title="Vui lòng kiểm tra lại các mục sau"
          errors={errors}
          submitCount={2}
        />
        <input aria-label="Khác" />
      </>,
    )
    expect(document.activeElement).toBe(screen.getByRole('alert'))
  })

  it('calls onNavigate with the field id instead of following the link (M2 minor)', async () => {
    const onNavigate = vi.fn()
    render(
      <FormErrorSummary
        title="Vui lòng kiểm tra lại các mục sau"
        errors={[{ fieldId: 'tracks.dsa.roadmapVariant', message: 'Chọn một phiên bản.' }]}
        onNavigate={onNavigate}
      />,
    )
    await userEvent.setup().click(screen.getByRole('link', { name: 'Chọn một phiên bản.' }))
    expect(onNavigate).toHaveBeenCalledExactlyOnceWith('tracks.dsa.roadmapVariant')
  })

  it('focuses the field itself without onNavigate (single-section forms)', async () => {
    render(
      <>
        <FormErrorSummary
          title="Vui lòng kiểm tra lại các mục sau"
          errors={[{ fieldId: 'minutes-field', message: 'Chọn số phút hợp lệ.' }]}
        />
        <input id="minutes-field" aria-label="Số phút" />
      </>,
    )
    await userEvent.setup().click(screen.getByRole('link', { name: 'Chọn số phút hợp lệ.' }))
    expect(document.activeElement).toBe(screen.getByLabelText('Số phút'))
  })

  it('never leaves the link dead: lets the native jump proceed when onNavigate reports it did not handle the field (M2 minor)', () => {
    const onNavigate = vi.fn(() => false)
    render(
      <FormErrorSummary
        title="Vui lòng kiểm tra lại các mục sau"
        errors={[{ fieldId: 'unknown-field', message: 'Lỗi không xác định.' }]}
        onNavigate={onNavigate}
      />,
    )
    const link = screen.getByRole('link', { name: 'Lỗi không xác định.' })
    const notPrevented = fireEvent.click(link)
    expect(onNavigate).toHaveBeenCalledExactlyOnceWith('unknown-field')
    expect(notPrevented).toBe(true)
  })

  it('never leaves the link dead: lets the native jump proceed without onNavigate when the field does not exist', () => {
    render(
      <FormErrorSummary
        title="Vui lòng kiểm tra lại các mục sau"
        errors={[{ fieldId: 'missing-field', message: 'Lỗi không xác định.' }]}
      />,
    )
    const link = screen.getByRole('link', { name: 'Lỗi không xác định.' })
    const notPrevented = fireEvent.click(link)
    expect(notPrevented).toBe(true)
  })
})
