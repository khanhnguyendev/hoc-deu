import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { cardItem, SAVED } from '@/features/items/fixtures'
import type { CardSessionCard, RecordOutcome } from '@/features/items/outcome'
import { REQUEST_ID } from '../__tests__/fixtures'
import type { BlockItemSlot } from '../slots'
import { CardBlock } from './card-block'

const sidesOf = (item: ReturnType<typeof cardItem>) => {
  const { front, back, hint, usage, example, pronunciation, lang } = item.content
  return { front, back, hint, usage, example, pronunciation, lang }
}

const BLOCKER = cardItem()
const UNBLOCK = cardItem({
  id: 'english:w01-unblock',
  localId: 'w01-unblock',
  title: 'unblock',
  content: { id: 'english:w01-unblock', front: 'unblock', back: 'gỡ vướng cho ai đó' },
})
const card = (item: ReturnType<typeof cardItem>, blockId: string): CardSessionCard => ({
  itemId: item.id,
  sides: sidesOf(item),
  blockId,
})
const ROWS: BlockItemSlot[] = [
  { itemId: BLOCKER.id, row: <a href="#w01-blocker">blocker</a> },
  { itemId: UNBLOCK.id, row: <a href="#w01-unblock">unblock</a> },
]

describe('CardBlock (decision 19)', () => {
  it("grades the block's cards inline: the session, not the rows", async () => {
    const user = userEvent.setup()
    const record = vi.fn<RecordOutcome>(async () => SAVED)
    render(
      <CardBlock
        cards={[card(BLOCKER, 'b-new'), card(UNBLOCK, 'b-new')]}
        items={ROWS}
        requestId={REQUEST_ID}
        record={record}
      />,
    )
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('Còn 2 thẻ')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Xem nghĩa' }))
    await user.click(screen.getByRole('button', { name: /^Biết/ }))
    expect(record).toHaveBeenCalledExactlyOnceWith({
      requestId: REQUEST_ID,
      itemId: BLOCKER.id,
      blockId: 'b-new',
      outcome: { type: 'item.result', result: 'know' },
    })
  })

  it('lists the rows when every card is already handled at mount', () => {
    render(<CardBlock cards={[]} items={ROWS} requestId={REQUEST_ID} record={vi.fn()} />)
    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'blocker',
      'unblock',
    ])
    expect(document.querySelector('[data-slot="card-session"]')).toBeNull()
  })

  it('keeps its session to the end when the page re-renders without the graded cards', async () => {
    const user = userEvent.setup()
    const record = vi.fn<RecordOutcome>(async () => SAVED)
    const { rerender } = render(
      <CardBlock
        cards={[card(BLOCKER, 'b-new')]}
        items={ROWS}
        requestId={REQUEST_ID}
        record={record}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Xem nghĩa' }))
    await user.click(screen.getByRole('button', { name: /^Biết/ }))
    expect(await screen.findByRole('heading', { name: 'Đã ôn xong' })).toBeTruthy()
    // The revalidated page has no card left to grade: the finished session stays.
    rerender(<CardBlock cards={[]} items={ROWS} requestId={REQUEST_ID} record={record} />)
    expect(screen.getByRole('heading', { name: 'Đã ôn xong' })).toBeTruthy()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('two card blocks on one page: a key grades only the card focus is in', async () => {
    const user = userEvent.setup()
    const record = vi.fn<RecordOutcome>(async () => SAVED)
    render(
      <>
        <section aria-label="Bài mới">
          <CardBlock
            cards={[card(BLOCKER, 'b-new')]}
            items={ROWS}
            requestId={REQUEST_ID}
            record={record}
          />
        </section>
        <section aria-label="Ôn tập">
          <CardBlock
            cards={[card(UNBLOCK, 'b-review')]}
            items={ROWS}
            requestId={REQUEST_ID}
            record={record}
          />
        </section>
      </>,
    )
    const first = screen.getByRole('region', { name: 'Bài mới' })
    const second = screen.getByRole('region', { name: 'Ôn tập' })
    await user.click(within(first).getByRole('button', { name: 'Xem nghĩa' }))
    await user.click(within(second).getByRole('button', { name: 'Xem nghĩa' }))
    within(first).getByRole('button', { name: 'Ẩn nghĩa' }).focus()
    act(() => {
      fireEvent.keyDown(document.activeElement!, { key: '3' })
    })
    expect(await within(first).findByRole('heading', { name: 'Đã ôn xong' })).toBeTruthy()
    expect(record).toHaveBeenCalledExactlyOnceWith({
      requestId: REQUEST_ID,
      itemId: BLOCKER.id,
      blockId: 'b-new',
      outcome: { type: 'item.result', result: 'dont_know' },
    })
    expect(within(second).getByRole('heading', { level: 2, name: 'unblock' })).toBeTruthy()
  })
})
