import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Reveal } from './reveal'

describe('Reveal', () => {
  it('hides its content behind a "Xem" button until opened', async () => {
    const user = userEvent.setup()
    render(
      <Reveal>
        <p>Nội dung ẩn</p>
      </Reveal>,
    )
    const button = screen.getByRole('button', { name: 'Xem' })
    expect(button.getAttribute('aria-expanded')).toBe('false')
    const content = document.getElementById(button.getAttribute('aria-controls') ?? '')
    expect(content).not.toBeNull()
    expect(content?.contains(screen.getByText('Nội dung ẩn'))).toBe(true)
    expect(content?.hidden).toBe(true)

    await user.click(button)
    expect(button.getAttribute('aria-expanded')).toBe('true')
    expect(button.textContent).toBe('Ẩn')
    expect(content?.hidden).toBe(false)

    await user.click(button)
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(content?.hidden).toBe(true)
  })

  it('uses its label in both states', async () => {
    const user = userEvent.setup()
    render(<Reveal label="Gợi ý">x</Reveal>)
    const button = screen.getByRole('button', { name: 'Gợi ý' })
    await user.click(button)
    expect(button.textContent).toBe('Gợi ý')
    expect(button.getAttribute('aria-expanded')).toBe('true')
  })
})
