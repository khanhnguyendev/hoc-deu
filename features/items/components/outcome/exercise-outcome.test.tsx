import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { fillBlankItem, outcomeBinding, REQUEST_ID, rewriteItem, SAVED } from '../../fixtures'
import type { RecordOutcome } from '../../outcome'
import { ExerciseOutcome } from './exercise-outcome'

const FILL = fillBlankItem()
const REWRITE = rewriteItem()

function setup(item: typeof FILL, withBinding = true) {
  const user = userEvent.setup()
  const record = vi.fn<RecordOutcome>(async () => SAVED)
  render(
    <ExerciseOutcome
      exercise={item.content}
      binding={withBinding ? outcomeBinding(record, { itemId: item.id }) : undefined}
    />,
  )
  return { user, record }
}

describe('ExerciseOutcome — fill-blank', () => {
  it('submits the checker’s grade: exercise.submitted { kind, grade }', async () => {
    const { user, record } = setup(FILL)
    await user.type(screen.getByRole('textbox', { name: 'Từ còn thiếu' }), 'blocked')
    await user.click(screen.getByRole('button', { name: 'Kiểm tra' }))
    expect(record).toHaveBeenCalledExactlyOnceWith({
      requestId: REQUEST_ID,
      itemId: FILL.id,
      outcome: { type: 'exercise.submitted', kind: 'fill-blank', grade: 'pass' },
    })
    expect(screen.getByText('Chính xác')).toBeTruthy()
    expect(await screen.findByText('Đã lưu kết quả.')).toBeTruthy()
  })

  it('"Kiểm tra" is busy while its grade saves: a check then is never silently dropped', async () => {
    const user = userEvent.setup()
    let resolve!: (value: typeof SAVED) => void
    const record = vi.fn<RecordOutcome>(
      () => new Promise((res) => (resolve = res as (value: typeof SAVED) => void)),
    )
    render(
      <ExerciseOutcome
        exercise={FILL.content}
        binding={outcomeBinding(record, { itemId: FILL.id })}
      />,
    )
    await user.type(screen.getByRole('textbox', { name: 'Từ còn thiếu' }), 'blocked')
    await user.click(screen.getByRole('button', { name: 'Kiểm tra' }))
    const check = screen.getByRole('button', { name: 'Kiểm tra' })
    expect(check.getAttribute('aria-busy')).toBe('true')
    await user.click(check)
    await user.type(screen.getByRole('textbox', { name: 'Từ còn thiếu' }), '{Enter}')
    expect(record).toHaveBeenCalledOnce()
    await act(async () => resolve(SAVED))
    expect(await screen.findByText('Đã lưu kết quả.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Kiểm tra' }).getAttribute('aria-busy')).toBeNull()
  })

  it('each check is a submission: a miss, then a pass after the hint is close', async () => {
    const { user, record } = setup(FILL)
    const blank = screen.getByRole('textbox', { name: 'Từ còn thiếu' })
    await user.type(blank, 'stuck')
    await user.click(screen.getByRole('button', { name: 'Kiểm tra' }))
    await screen.findByText('Đã lưu kết quả.')
    await user.click(screen.getByRole('button', { name: 'Xem gợi ý' }))
    await user.clear(blank)
    await user.type(blank, 'blocked')
    await user.click(screen.getByRole('button', { name: 'Kiểm tra' }))
    expect(record.mock.calls.map(([input]) => input.outcome)).toEqual([
      { type: 'exercise.submitted', kind: 'fill-blank', grade: 'miss' },
      { type: 'exercise.submitted', kind: 'fill-blank', grade: 'close' },
    ])
  })
})

describe('ExerciseOutcome — respond / rewrite', () => {
  it('self-grades after "Xem câu trả lời mẫu"; never sends the answer text', async () => {
    const { user, record } = setup(REWRITE)
    await user.type(screen.getByRole('textbox', { name: 'Câu trả lời của bạn' }), 'Please fix it.')
    expect(screen.queryByRole('group', { name: 'Tự chấm theo tiêu chí' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Xem câu trả lời mẫu' }))
    const group = screen.getByRole('group', { name: 'Tự chấm theo tiêu chí' })
    expect(
      within(group)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Đạt', 'Gần đạt', 'Chưa đạt'])
    await user.click(within(group).getByRole('button', { name: 'Gần đạt' }))
    expect(record).toHaveBeenCalledExactlyOnceWith({
      requestId: REQUEST_ID,
      itemId: REWRITE.id,
      outcome: { type: 'exercise.submitted', kind: 'rewrite', grade: 'close' },
    })
    expect(JSON.stringify(record.mock.calls)).not.toContain('Please fix it.')
    expect(screen.getByText('Câu trả lời không được lưu.')).toBeTruthy()
    expect(await screen.findByText('Đã lưu kết quả.')).toBeTruthy()
    expect(
      within(group).getByRole('button', { name: 'Gần đạt' }).getAttribute('aria-pressed'),
    ).toBe('true')
  })
})

describe('ExerciseOutcome — read-only (no binding)', () => {
  it('renders the exercise with no self-grading and no live result', async () => {
    const { user, record } = setup(REWRITE, false)
    await user.click(screen.getByRole('button', { name: 'Xem câu trả lời mẫu' }))
    expect(screen.queryByRole('group', { name: 'Tự chấm theo tiêu chí' })).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
    expect(record).not.toHaveBeenCalled()
  })

  it('a fill-blank still checks, and records nothing', async () => {
    const { user, record } = setup(FILL, false)
    await user.type(screen.getByRole('textbox', { name: 'Từ còn thiếu' }), 'blocked')
    await user.click(screen.getByRole('button', { name: 'Kiểm tra' }))
    expect(screen.getByText('Chính xác')).toBeTruthy()
    expect(record).not.toHaveBeenCalled()
  })
})
