import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Input } from '@/components/ui/input'
import { FormField } from './form-field'

describe('FormField', () => {
  it('wires the label, description and error to the control', () => {
    render(
      <FormField
        id="email"
        label="Email"
        description="Dùng để đăng nhập"
        error="Email chưa đúng định dạng."
      >
        {(control) => <Input {...control} type="email" />}
      </FormField>,
    )
    const input = screen.getByLabelText('Email')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(input.getAttribute('aria-describedby')).toContain('email-description')
    expect(input.getAttribute('aria-describedby')).toContain('email-error')
    expect(screen.getByText('Dùng để đăng nhập')).toBeTruthy()
    expect(screen.getByText('Email chưa đúng định dạng.')).toBeTruthy()
  })

  it('has no aria-invalid or aria-describedby when there is no description or error', () => {
    render(
      <FormField id="name" label="Tên">
        {(control) => <Input {...control} />}
      </FormField>,
    )
    const input = screen.getByLabelText('Tên')
    expect(input.getAttribute('aria-invalid')).toBeNull()
    expect(input.getAttribute('aria-describedby')).toBeNull()
  })

  it('marks required fields required', () => {
    render(
      <FormField id="minutes" label="Số phút" required>
        {(control) => <Input {...control} inputMode="numeric" />}
      </FormField>,
    )
    const input = screen.getByLabelText(/Số phút/) as HTMLInputElement
    expect(input.required).toBe(true)
  })
})
