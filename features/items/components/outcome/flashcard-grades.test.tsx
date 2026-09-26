import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { outcomeBinding, REQUEST_ID, SAVED } from '../../fixtures'
import type { RecordOutcome } from '../../outcome'
import { FlashcardGrades, FlashcardOutcome } from './flashcard-grades'

const press = (key: string, init: KeyboardEventInit = {}) =>
  act(() => {
    fireEvent.keyDown(document.body, { key, ...init })
  })

describe('FlashcardGrades (DESIGN_SYSTEM §9)', () => {
  it('shows "Biết" / "Chưa chắc" / "Không biết" with their keys 1 / 2 / 3', () => {
    render(<FlashcardGrades onGrade={() => {}} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons.map((button) => button.getAttribute('aria-keyshortcuts'))).toEqual([
      '1',
      '2',
      '3',
    ])
    expect(screen.getByRole('button', { name: /^Biết/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Chưa chắc/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Không biết/ })).toBeTruthy()
  })

  it('grades with a click or with the keys 1 / 2 / 3', async () => {
    const user = userEvent.setup()
    const onGrade = vi.fn()
    render(<FlashcardGrades onGrade={onGrade} />)
    await user.click(screen.getByRole('button', { name: /^Không biết/ }))
    press('1')
    press('2')
    press('3')
    expect(onGrade.mock.calls).toEqual([['dont_know'], ['know'], ['unsure'], ['dont_know']])
  })

  it('ignores the keys with a modifier, while typing, while saving and when disabled', () => {
    const onGrade = vi.fn()
    const { rerender } = render(
      <>
        <input aria-label="Ghi chú" />
        <FlashcardGrades onGrade={onGrade} />
      </>,
    )
    press('1', { ctrlKey: true })
    press('2', { metaKey: true })
    press('3', { altKey: true })
    act(() => {
      fireEvent.keyDown(screen.getByRole('textbox'), { key: '1' })
    })
    press('4')
    rerender(<FlashcardGrades onGrade={onGrade} pending="know" />)
    press('2')
    rerender(<FlashcardGrades onGrade={onGrade} disabled />)
    press('2')
    expect(onGrade).not.toHaveBeenCalled()
  })

  it('stops listening when it unmounts', () => {
    const onGrade = vi.fn()
    const { unmount } = render(<FlashcardGrades onGrade={onGrade} />)
    unmount()
    press('1')
    expect(onGrade).not.toHaveBeenCalled()
  })
})

describe('FlashcardOutcome (the flashcard page)', () => {
  it('sends item.result with the grade, the block and the render’s request id', async () => {
    const user = userEvent.setup()
    const record = vi.fn<RecordOutcome>(async () => SAVED)
    render(
      <FlashcardOutcome
        binding={outcomeBinding(record, { itemId: 'english:w01-blocker', blockId: 'b1' })}
      />,
    )
    await user.click(screen.getByRole('button', { name: /^Chưa chắc/ }))
    expect(record).toHaveBeenCalledExactlyOnceWith({
      requestId: REQUEST_ID,
      itemId: 'english:w01-blocker',
      blockId: 'b1',
      outcome: { type: 'item.result', result: 'unsure' },
    })
    expect(await screen.findByText('Đã lưu kết quả.')).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Chưa chắc/ }).getAttribute('aria-pressed')).toBe(
      'true',
    )
  })

  it('key 2 grades "unsure" (no block: off-plan)', async () => {
    const record = vi.fn<RecordOutcome>(async () => SAVED)
    render(<FlashcardOutcome binding={outcomeBinding(record, { itemId: 'english:w01-blocker' })} />)
    press('2')
    expect(record).toHaveBeenCalledExactlyOnceWith({
      requestId: REQUEST_ID,
      itemId: 'english:w01-blocker',
      outcome: { type: 'item.result', result: 'unsure' },
    })
    expect(await screen.findByText('Đã lưu kết quả.')).toBeTruthy()
  })

  it('says why a grade was not saved, presses nothing, and lets the learner try again', async () => {
    const user = userEvent.setup()
    const record = vi
      .fn<RecordOutcome>()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({
        ok: false,
        message: 'Kế hoạch đã thay đổi — tải lại trang.',
        autoCheckedIn: [],
      })
    render(<FlashcardOutcome binding={outcomeBinding(record)} />)
    await user.click(screen.getByRole('button', { name: /^Biết/ }))
    expect(await screen.findByText('Chưa lưu được kết quả. Bạn thử lại nhé.')).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Biết/ }).getAttribute('aria-pressed')).toBe('false')
    await user.click(screen.getByRole('button', { name: /^Biết/ }))
    expect(await screen.findByText('Kế hoạch đã thay đổi — tải lại trang.')).toBeTruthy()
    expect(record).toHaveBeenCalledTimes(2)
  })
})
