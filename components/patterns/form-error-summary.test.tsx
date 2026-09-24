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
})
