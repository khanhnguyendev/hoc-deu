import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { outcomeBinding, REQUEST_ID, SAVED } from '../../fixtures'
import type { RecordOutcome } from '../../outcome'
import { FlashcardGrades, FlashcardOutcome } from './flashcard-grades'

/** A key pressed inside the grades (the card, when there is one): where the listener sits. */
const press = (key: string, init: KeyboardEventInit = {}) =>
  act(() => {
    fireEvent.keyDown(screen.getAllByRole('button')[0]!, { key, ...init })
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

  it('ignores the keys with a modifier, while typing or composing, while saving and when disabled', () => {
    const onGrade = vi.fn()
    // A card with a field in it: the listener sits on the card.
    const card = (props: { pending?: 'know'; disabled?: boolean }) => (
      <div data-slot="flashcard-view">
        <input aria-label="Ghi chú" />
        <FlashcardGrades onGrade={onGrade} {...props} />
      </div>
    )
    const { rerender } = render(card({}))
    press('1', { ctrlKey: true })
    press('2', { metaKey: true })
    press('3', { altKey: true })
    press('1', { isComposing: true })
    act(() => {
      fireEvent.keyDown(screen.getByRole('textbox'), { key: '1' })
    })
    press('4')
    rerender(card({ pending: 'know' }))
    press('2')
    rerender(card({ disabled: true }))
    press('2')
    expect(onGrade).not.toHaveBeenCalled()
  })

  it('takes keys pressed anywhere in its card; never on the page outside it', () => {
    const onGrade = vi.fn()
    render(
      <div data-slot="flashcard-view" data-testid="card">
        <h2>blocker</h2>
        <FlashcardGrades onGrade={onGrade} />
      </div>,
    )
    act(() => {
      fireEvent.keyDown(screen.getByTestId('card'), { key: '3' })
      fireEvent.keyDown(document.body, { key: '1' })
    })
    expect(onGrade.mock.calls).toEqual([['dont_know']])
  })

  it('stops listening when it unmounts', () => {
    const onGrade = vi.fn()
    const { unmount } = render(<FlashcardGrades onGrade={onGrade} />)
    const button = screen.getAllByRole('button')[0]!
    unmount()
    act(() => {
      fireEvent.keyDown(button, { key: '1' })
    })
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
    // The live region names the grade, so a later save is new text (announced again).
    expect(screen.getByRole('status').textContent).toBe('Chưa chắc: Đã lưu kết quả.')
    expect(screen.getByRole('button', { name: /^Chưa chắc/ }).getAttribute('aria-pressed')).toBe(
      'true',
    )
    // The saved grade again (after a re-render, with a new request id) records nothing more.
    await user.click(screen.getByRole('button', { name: /^Chưa chắc/ }))
    expect(record).toHaveBeenCalledOnce()
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
