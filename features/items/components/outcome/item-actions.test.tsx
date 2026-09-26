import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { outcomeBinding, REQUEST_ID, SAVED } from '../../fixtures'
import type { OutcomeBinding, RecordOutcome } from '../../outcome'
import { ItemActions } from './item-actions'

function setup(patch: Partial<Omit<OutcomeBinding, 'record'>> = {}) {
  const user = userEvent.setup()
  const record = vi.fn<RecordOutcome>(async () => SAVED)
  const view = render(<ItemActions binding={outcomeBinding(record, patch)} />)
  return { user, record, view }
}

const MASTERED = { status: 'mastered', level: 3, dueOn: null } as const
const OK_NOT_DUE = { status: 'ok', level: 1, dueOn: '2026-10-12' } as const

describe('ItemActions (§5.7)', () => {
  it('"Bỏ qua mục này" asks first; confirming sends item.skipped', async () => {
    const { user, record } = setup({ blockId: 'b-new' })
    await user.click(screen.getByRole('button', { name: 'Bỏ qua mục này' }))
    const dialog = screen.getByRole('alertdialog', { name: 'Bỏ qua mục này?' })
    expect(record).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Bỏ qua' }))
    expect(record).toHaveBeenCalledExactlyOnceWith({
      requestId: REQUEST_ID,
      itemId: 'dsa:lc-0001',
      blockId: 'b-new',
      outcome: { type: 'item.skipped' },
    })
    expect(await screen.findByText('Đã lưu kết quả.')).toBeTruthy()
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('cancelling sends nothing', async () => {
    const { user, record } = setup()
    await user.click(screen.getByRole('button', { name: 'Bỏ qua mục này' }))
    await user.click(screen.getByRole('button', { name: 'Huỷ' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(record).not.toHaveBeenCalled()
  })

  it('offers the skip while the item is due, not once it is scheduled or skipped', () => {
    setup({ state: OK_NOT_DUE, due: true })
    expect(screen.getByRole('button', { name: 'Bỏ qua mục này' })).toBeTruthy()
  })

  it('renders nothing for a studied item that is neither due nor mastered', () => {
    const { view } = setup({ state: OK_NOT_DUE, due: false })
    expect(view.container.innerHTML).toBe('')
  })

  it('"Ôn lại" puts a mastered item back into review: item.readded', async () => {
    const { user, record } = setup({ state: MASTERED })
    expect(screen.queryByRole('button', { name: 'Bỏ qua mục này' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Ôn lại' }))
    expect(record).toHaveBeenCalledExactlyOnceWith({
      requestId: REQUEST_ID,
      itemId: 'dsa:lc-0001',
      outcome: { type: 'item.readded' },
    })
    expect(await screen.findByText('Đã lưu kết quả.')).toBeTruthy()
  })

  it('keeps its message after the action it came from is gone (the page re-rendered)', async () => {
    const user = userEvent.setup()
    const record = vi.fn<RecordOutcome>(async () => SAVED)
    const { rerender } = render(<ItemActions binding={outcomeBinding(record)} />)
    await user.click(screen.getByRole('button', { name: 'Bỏ qua mục này' }))
    await user.click(screen.getByRole('button', { name: 'Bỏ qua' }))
    await screen.findByText('Đã lưu kết quả.')
    rerender(
      <ItemActions
        binding={outcomeBinding(record, { state: { status: 'skipped', level: 0, dueOn: null } })}
      />,
    )
    expect(screen.queryByRole('button', { name: 'Bỏ qua mục này' })).toBeNull()
    expect(screen.getByRole('status').textContent).toBe('Đã lưu kết quả.')
  })
})
