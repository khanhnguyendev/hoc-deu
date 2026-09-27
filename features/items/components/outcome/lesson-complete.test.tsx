import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { outcomeBinding, REQUEST_ID, SAVED } from '../../fixtures'
import type { RecordOutcome } from '../../outcome'
import { Choice, Question, Quiz } from '../mdx/quiz'
import { LessonComplete } from './lesson-complete'

const BODY = (
  <div data-testid="lesson">
    <p>Hai con trỏ đi từ hai đầu mảng.</p>
    <Quiz>
      <Question prompt="Mảng cần sắp xếp trước không?" answer="yes">
        <Choice id="yes">Có</Choice>
        <Choice id="no">Không</Choice>
      </Question>
      <Question prompt="Độ phức tạp?" answer="n">
        <Choice id="n">O(n)</Choice>
        <Choice id="n2">O(n^2)</Choice>
      </Question>
    </Quiz>
  </div>
)

function setup() {
  const user = userEvent.setup()
  const record = vi.fn<RecordOutcome>(async () => SAVED)
  render(
    <LessonComplete
      binding={outcomeBinding(record, { itemId: 'dsa:lesson-two-pointers', blockId: 'b-new' })}
    >
      {BODY}
    </LessonComplete>,
  )
  return { user, record }
}

describe('LessonComplete', () => {
  it('renders the lesson, then "Hoàn thành bài học" — the view’s one primary (the quiz check steps down)', () => {
    setup()
    expect(screen.getByTestId('lesson')).toBeTruthy()
    const complete = screen.getByRole('button', { name: 'Hoàn thành bài học' })
    expect(complete.dataset.variant).toBe('primary')
    expect(screen.getByRole('button', { name: 'Kiểm tra' }).dataset.variant).toBe('secondary')
    expect(
      screen.getAllByRole('button').filter((button) => button.dataset.variant === 'primary'),
    ).toEqual([complete])
  })

  it('sends lesson.completed without a score when the quiz was not answered', async () => {
    const { user, record } = setup()
    await user.click(screen.getByRole('button', { name: 'Hoàn thành bài học' }))
    expect(record).toHaveBeenCalledExactlyOnceWith({
      requestId: REQUEST_ID,
      itemId: 'dsa:lesson-two-pointers',
      blockId: 'b-new',
      outcome: { type: 'lesson.completed' },
    })
    expect(await screen.findByText('Đã lưu kết quả.')).toBeTruthy()
  })

  it('sends the Quiz’s score (0–100) once it was checked, and says so', async () => {
    const { user, record } = setup()
    await user.click(screen.getByRole('radio', { name: 'Có' }))
    await user.click(screen.getByRole('radio', { name: 'O(n^2)' }))
    await user.click(screen.getByRole('button', { name: 'Kiểm tra' }))
    expect(screen.getByText('Kèm điểm kiểm tra nhanh: 50%')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Hoàn thành bài học' }))
    expect(record.mock.calls[0]![0].outcome).toEqual({ type: 'lesson.completed', quizScore: 50 })
    await screen.findByText('Đã lưu kết quả.')
    // (The quiz has its own status region: pick the outcome's.)
    const outcome = screen
      .getAllByRole('status')
      .find((region) => region.dataset.slot === 'outcome-message')
    expect(outcome?.textContent).toBe('Hoàn thành bài học: Đã lưu kết quả.')
    // The same completion again records nothing more — and says so (m-10); a new score does.
    await user.click(screen.getByRole('button', { name: 'Hoàn thành bài học' }))
    expect(record).toHaveBeenCalledOnce()
    expect(outcome?.textContent).toBe('Hoàn thành bài học: Kết quả này đã được lưu.')
    await user.click(screen.getByRole('button', { name: 'Làm lại' }))
    await user.click(screen.getByRole('radio', { name: 'Có' }))
    await user.click(screen.getByRole('radio', { name: 'O(n)' }))
    await user.click(screen.getByRole('button', { name: 'Kiểm tra' }))
    await user.click(screen.getByRole('button', { name: 'Hoàn thành bài học' }))
    expect(record.mock.calls[1]![0].outcome).toEqual({ type: 'lesson.completed', quizScore: 100 })
  })
})
