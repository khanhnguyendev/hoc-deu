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
  it('renders the lesson, then the one primary "Hoàn thành bài học"', () => {
    setup()
    expect(screen.getByTestId('lesson')).toBeTruthy()
    const complete = screen.getByRole('button', { name: 'Hoàn thành bài học' })
    expect(complete.dataset.variant).toBe('primary')
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
  })
})
