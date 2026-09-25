import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { FillBlankExercise } from './fill-blank-exercise'

const TEXT = "I'm {{blank}} on the API review — could someone help?"
const HINT = "Từ này nghĩa là 'bị chặn, không làm tiếp được'."

function setup(props: Partial<Parameters<typeof FillBlankExercise>[0]> = {}) {
  const user = userEvent.setup()
  const view = render(
    <FillBlankExercise text={TEXT} answers={['blocked']} hint={HINT} {...props} />,
  )
  return { user, ...view }
}

describe('FillBlankExercise', () => {
  it('renders the English text with the blank as a labelled input', () => {
    const { container } = setup()
    const input = screen.getByRole('textbox', { name: 'Từ còn thiếu' })
    const text = container.querySelector('[data-slot="fill-blank-text"]')
    expect(text?.getAttribute('lang')).toBe('en')
    expect(text?.contains(input)).toBe(true)
    expect(text?.textContent).toContain("I'm")
    expect(text?.textContent).toContain('on the API review — could someone help?')
    expect(text?.textContent).not.toContain('{{blank}}')
  })

  it('pass: a correct answer, case- and whitespace-insensitive → "Chính xác"', async () => {
    const { user } = setup()
    await user.type(screen.getByRole('textbox'), '  Blocked ')
    await user.click(screen.getByRole('button', { name: 'Kiểm tra' }))
    const status = screen.getByRole('status')
    expect(status.textContent).toBe('Chính xác')
    expect(status.querySelector('svg')).not.toBeNull()
  })

  it('close: correct after revealing the hint → "Gần đúng — bạn đã xem gợi ý"', async () => {
    const { user } = setup()
    const reveal = screen.getByRole('button', { name: 'Xem gợi ý' })
    expect(screen.queryByText(HINT)).toBeNull()
    await user.click(reveal)
    expect(screen.getByText(HINT)).toBeTruthy()
    expect(reveal.getAttribute('aria-expanded')).toBe('true')
    await user.type(screen.getByRole('textbox'), 'blocked')
    await user.click(screen.getByRole('button', { name: 'Kiểm tra' }))
    expect(screen.getByRole('status').textContent).toBe('Gần đúng — bạn đã xem gợi ý')
  })

  it('miss: a wrong or empty answer → "Chưa đúng — đáp án: blocked" (the answer in English)', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Kiểm tra' }))
    expect(screen.getByRole('status').textContent).toBe('Chưa đúng — đáp án: blocked')
    await user.type(screen.getByRole('textbox'), 'stuck')
    expect(screen.getByRole('status').textContent).toBe('')
    await user.click(screen.getByRole('button', { name: 'Kiểm tra' }))
    const status = screen.getByRole('status')
    expect(status.textContent).toBe('Chưa đúng — đáp án: blocked')
    expect(screen.getByText('blocked').getAttribute('lang')).toBe('en')
  })

  it('[RF-3] a decomposed (NFD) answer passes against an NFC key', async () => {
    const { user } = setup({
      text: 'Order a {{blank}}, please.',
      answers: ['café'],
      hint: undefined,
    })
    await user.type(screen.getByRole('textbox'), 'café'.normalize('NFD'))
    await user.click(screen.getByRole('button', { name: 'Kiểm tra' }))
    expect(screen.getByRole('status').textContent).toBe('Chính xác')
  })

  it('offers no hint button without a hint', () => {
    setup({ hint: undefined })
    expect(screen.queryByRole('button', { name: 'Xem gợi ý' })).toBeNull()
  })
})
