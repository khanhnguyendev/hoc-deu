import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SelfGradedExercise } from './self-graded-exercise'

const SAMPLE =
  "Thanks for the PR! I think there's an issue in the retry logic — could you take a look?"

function setup(rubricLang: 'en' | 'vi' = 'en') {
  const user = userEvent.setup()
  const view = render(
    <SelfGradedExercise
      text="Your PR is wrong. Fix it."
      sampleAnswers={[SAMPLE]}
      rubric={['polite opener', 'specific issue', 'clear ask']}
      rubricLang={rubricLang}
    />,
  )
  return { user, ...view }
}

describe('SelfGradedExercise (respond / rewrite)', () => {
  it('shows the text in English and a labelled answer box that says it is not saved', () => {
    const { container } = setup()
    expect(container.querySelector('[data-slot="exercise-text"]')?.getAttribute('lang')).toBe('en')
    const answer = screen.getByRole('textbox', { name: 'Câu trả lời của bạn' })
    expect(answer.getAttribute('lang')).toBe('en')
    const describedBy = answer.getAttribute('aria-describedby') ?? ''
    expect(document.getElementById(describedBy)?.textContent).toBe('Câu trả lời không được lưu.')
  })

  it('hides the sample answers and the rubric until "Xem câu trả lời mẫu"', async () => {
    const { user } = setup()
    expect(screen.queryByText(SAMPLE)).toBeNull()
    expect(screen.queryByRole('list', { name: 'Tiêu chí' })).toBeNull()

    const toggle = screen.getByRole('button', { name: 'Xem câu trả lời mẫu' })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    await user.click(toggle)

    expect(screen.getByText(SAMPLE).closest('[lang]')?.getAttribute('lang')).toBe('en')
    const rubric = screen.getByRole('list', { name: 'Tiêu chí' })
    expect(within(rubric).getAllByRole('listitem')).toHaveLength(3)
    expect(rubric.getAttribute('lang')).toBe('en')
    // The rubric sits inside the sample-answers panel: an h3 under its h2.
    expect(screen.getByRole('heading', { level: 2, name: 'Câu trả lời mẫu' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 3, name: 'Tiêu chí' })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Ẩn câu trả lời mẫu' }))
    expect(screen.queryByText(SAMPLE)).toBeNull()
  })

  it('a Vietnamese rubric (the schema default) keeps the page language (M3-R5)', async () => {
    const { user } = setup('vi')
    await user.click(screen.getByRole('button', { name: 'Xem câu trả lời mẫu' }))
    expect(screen.getByRole('list', { name: 'Tiêu chí' }).hasAttribute('lang')).toBe(false)
    expect(screen.getByText(SAMPLE).closest('[lang]')?.getAttribute('lang')).toBe('en')
  })

  it('keeps what the learner typed when the samples open and close', async () => {
    const { user } = setup()
    const answer = screen.getByRole('textbox', { name: 'Câu trả lời của bạn' })
    await user.type(answer, 'Could you check the retry logic?')
    await user.click(screen.getByRole('button', { name: 'Xem câu trả lời mẫu' }))
    expect((answer as HTMLTextAreaElement).value).toBe('Could you check the retry logic?')
  })

  it('offers no self-grading without onGrade (a read-only page)', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Xem câu trả lời mẫu' }))
    expect(screen.queryByRole('group', { name: 'Tự chấm theo tiêu chí' })).toBeNull()
  })

  it('task 5.2c: self-grades against the rubric after the samples — Đạt / Gần đạt / Chưa đạt', async () => {
    const user = userEvent.setup()
    const onGrade = vi.fn()
    const { rerender } = render(
      <SelfGradedExercise
        text="Your PR is wrong. Fix it."
        sampleAnswers={[SAMPLE]}
        rubric={['polite opener']}
        onGrade={onGrade}
      />,
    )
    expect(screen.queryByRole('group', { name: 'Tự chấm theo tiêu chí' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Xem câu trả lời mẫu' }))
    const group = screen.getByRole('group', { name: 'Tự chấm theo tiêu chí' })
    await user.click(within(group).getByRole('button', { name: 'Chưa đạt' }))
    expect(onGrade).toHaveBeenCalledExactlyOnceWith('miss')
    // The grades stay once the samples were seen, and show the saved (or saving) grade.
    await user.click(screen.getByRole('button', { name: 'Ẩn câu trả lời mẫu' }))
    rerender(
      <SelfGradedExercise
        text="Your PR is wrong. Fix it."
        sampleAnswers={[SAMPLE]}
        rubric={['polite opener']}
        onGrade={onGrade}
        selectedGrade="pass"
        pendingGrade="close"
      />,
    )
    expect(screen.getByRole('button', { name: 'Đạt' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Gần đạt' }).getAttribute('aria-busy')).toBe('true')
  })
})
