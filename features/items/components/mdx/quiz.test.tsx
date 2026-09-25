import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Choice, Question, Quiz } from './quiz'

function ThreeQuestions({ onScore }: { onScore?: Parameters<typeof Quiz>[0]['onScore'] }) {
  return (
    <Quiz onScore={onScore}>
      <Question prompt="Câu 1" answer="a">
        <Choice id="a">Một A</Choice>
        <Choice id="b">Một B</Choice>
      </Question>
      <Question prompt="Câu 2" answer="b">
        <Choice id="a">Hai A</Choice>
        <Choice id="b">Hai B</Choice>
      </Question>
      <Question prompt="Câu 3" answer="a">
        <Choice id="a">
          <code>O(n)</code>
        </Choice>
        <Choice id="b">Ba B</Choice>
      </Question>
    </Quiz>
  )
}

const question = (name: string) => screen.getByRole('group', { name })
const radio = (group: string, name: string) => within(question(group)).getByRole('radio', { name })

describe('Quiz', () => {
  it('renders each question as a fieldset with its prompt as the legend and native radios', () => {
    render(<ThreeQuestions />)
    const first = question('Câu 1')
    expect(first.tagName).toBe('FIELDSET')
    expect(first.querySelector('legend')?.textContent).toBe('Câu 1')
    const choice = radio('Câu 1', 'Một A') as HTMLInputElement
    expect(choice.type).toBe('radio')
    expect(choice.closest('[data-slot="choice"]')?.className).toContain('min-h-11')
  })

  it('makes the whole card the target: a stretched label for the radio selects it', async () => {
    render(<ThreeQuestions />)
    const choice = radio('Câu 2', 'Hai B') as HTMLInputElement
    const card = choice.closest('[data-slot="choice"]')!
    const label = card.querySelector(`label[for="${choice.id}"]`)!
    expect(label.className).toContain('absolute inset-0')
    await userEvent.setup().click(label)
    expect(choice.checked).toBe(true)
  })

  it('scores 2 of 3, announces "Đúng 2/3" politely and reports the rounded percent', async () => {
    const onScore = vi.fn()
    const user = userEvent.setup()
    render(<ThreeQuestions onScore={onScore} />)
    const status = screen.getByRole('status')
    expect(status.getAttribute('aria-live')).toBe('polite')
    expect(status.textContent).toBe('')

    await user.click(radio('Câu 1', 'Một A'))
    await user.click(radio('Câu 2', 'Hai B'))
    await user.click(radio('Câu 3', 'Ba B'))
    await user.click(screen.getByRole('button', { name: 'Kiểm tra' }))

    expect(status.textContent).toBe('Đúng 2/3')
    expect(onScore).toHaveBeenCalledOnce()
    expect(onScore).toHaveBeenCalledWith({ correct: 2, total: 3, percent: 67 })
  })

  it('shows an icon and a verdict under each question, with the right answer when wrong', async () => {
    const user = userEvent.setup()
    render(<ThreeQuestions />)
    await user.click(radio('Câu 1', 'Một A'))
    await user.click(radio('Câu 3', 'Ba B'))
    await user.click(screen.getByRole('button', { name: 'Kiểm tra' }))

    const right = within(question('Câu 1'))
      .getByText('Chính xác')
      .closest('[data-slot="quiz-feedback"]')
    expect(right?.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    const wrong = question('Câu 3').querySelector('[data-slot="quiz-feedback"]')
    expect(wrong?.textContent).toBe('Chưa đúng — đáp án: O(n)')
    expect(wrong?.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('counts a question without a selection as wrong', async () => {
    const onScore = vi.fn()
    const user = userEvent.setup()
    render(<ThreeQuestions onScore={onScore} />)
    await user.click(radio('Câu 1', 'Một A'))
    await user.click(radio('Câu 2', 'Hai B'))
    await user.click(screen.getByRole('button', { name: 'Kiểm tra' }))

    expect(onScore).toHaveBeenCalledWith({ correct: 2, total: 3, percent: 67 })
    const unanswered = question('Câu 3').querySelector('[data-slot="quiz-feedback"]')
    expect(unanswered?.textContent).toBe('Chưa đúng — đáp án: O(n)')
  })

  it('"Làm lại" clears the answers, the verdicts and the score', async () => {
    const user = userEvent.setup()
    render(<ThreeQuestions />)
    await user.click(radio('Câu 1', 'Một B'))
    await user.click(screen.getByRole('button', { name: 'Kiểm tra' }))
    expect(screen.getByRole('status').textContent).toBe('Đúng 0/3')

    await user.click(screen.getByRole('button', { name: 'Làm lại' }))
    expect(screen.getByRole('status').textContent).toBe('')
    expect(screen.queryByText(/Chưa đúng|Chính xác/)).toBeNull()
    for (const input of screen.getAllByRole('radio')) {
      expect((input as HTMLInputElement).checked).toBe(false)
    }
    expect(screen.getByRole('button', { name: 'Kiểm tra' })).toBeTruthy()
  })

  it('moves the selection with the arrow keys within one question only', async () => {
    const user = userEvent.setup()
    render(<ThreeQuestions />)
    await user.click(radio('Câu 1', 'Một A'))
    await user.keyboard('{ArrowDown}')
    expect((radio('Câu 1', 'Một B') as HTMLInputElement).checked).toBe(true)
    expect(document.activeElement).toBe(radio('Câu 1', 'Một B'))
    await user.keyboard('{ArrowDown}')
    expect((radio('Câu 1', 'Một A') as HTMLInputElement).checked).toBe(true)
    for (const input of within(question('Câu 2')).getAllByRole('radio')) {
      expect((input as HTMLInputElement).checked).toBe(false)
    }
  })

  it('keeps valid HTML for paragraph-form choices, also in the verdict (no React warning)', async () => {
    const consoleError = vi.spyOn(console, 'error')
    const user = userEvent.setup()
    const { container } = render(
      <Quiz>
        <Question prompt="Câu p" answer="b">
          <Choice id="a">
            <p>Một</p>
          </Choice>
          <Choice id="b">
            <p>
              Hai <code>x</code>
            </p>
            <p>dòng hai</p>
          </Choice>
        </Question>
      </Quiz>,
    )
    await user.click(radio('Câu p', 'Một'))
    await user.click(screen.getByRole('button', { name: 'Kiểm tra' }))

    const verdict = question('Câu p').querySelector('[data-slot="quiz-feedback"]')
    expect(verdict?.textContent).toBe('Chưa đúng — đáp án: Hai xdòng hai')
    // Phrasing-only containers never hold a paragraph; labels hold no content at all.
    expect(container.querySelector('p p, span p, label p, label div')).toBeNull()
    expect(consoleError).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('never divides by zero for an empty quiz (the check rejects one; render defensively)', async () => {
    const onScore = vi.fn()
    const user = userEvent.setup()
    render(<Quiz onScore={onScore} />)
    await user.click(screen.getByRole('button', { name: 'Kiểm tra' }))
    expect(onScore).toHaveBeenCalledWith({ correct: 0, total: 0, percent: 0 })
    expect(screen.getByRole('status').textContent).toBe('Đúng 0/0')
  })
})
