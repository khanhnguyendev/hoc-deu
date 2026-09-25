import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Label } from './label'
import { NativeSelect } from './native-select'

describe('NativeSelect', () => {
  it('is a labelled combobox and accepts a selection', async () => {
    render(
      <>
        <Label htmlFor="tz">Múi giờ</Label>
        <NativeSelect id="tz" defaultValue="Asia/Ho_Chi_Minh">
          <option value="Asia/Ho_Chi_Minh">Asia/Ho_Chi_Minh</option>
          <option value="Asia/Bangkok">Asia/Bangkok</option>
        </NativeSelect>
      </>,
    )
    const select = screen.getByRole('combobox', { name: 'Múi giờ' })
    await userEvent.setup().selectOptions(select, 'Asia/Bangkok')
    expect(select).toHaveProperty('value', 'Asia/Bangkok')
  })

  it('is 44 px tall, border-strong, and shows invalid styling', () => {
    render(<NativeSelect aria-label="Chọn" aria-invalid />)
    const select = screen.getByRole('combobox', { name: 'Chọn' })
    expect(select.className).toContain('h-11')
    expect(select.className).toContain('border-border-strong')
    expect(select.className).toContain('aria-invalid:border-danger')
  })
})
