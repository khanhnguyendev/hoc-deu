import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { cardItem, SAVED } from '@/features/items/fixtures'
import {
  cardSidesOf,
  type CardSessionCard,
  type FlashcardSides,
  type RecordOutcome,
} from '@/features/items/outcome'
import { REQUEST_ID } from '../__tests__/fixtures'
import type { BlockItemSlot } from '../slots'
import { CardBlock } from './card-block'

/** The shared mapping (parked #7): no copy of it here. */
const sidesOf = (item: ReturnType<typeof cardItem>): FlashcardSides => cardSidesOf(item)!

const BLOCKER = cardItem()
const UNBLOCK = cardItem({
  id: 'english:w01-unblock',
  localId: 'w01-unblock',
  title: 'unblock',
  content: { id: 'english:w01-unblock', front: 'unblock', back: 'gỡ vướng cho ai đó' },
})
const ON_TRACK = cardItem({
  id: 'english:w01-on-track',
  localId: 'w01-on-track',
  title: 'on track',
  content: { id: 'english:w01-on-track', front: 'on track', back: 'đúng tiến độ' },
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
/** The block after "Học thêm" appended a card (or an off-plan result landed in it). */
const GROWN: BlockItemSlot[] = [
  ...ROWS,
  { itemId: ON_TRACK.id, row: <a href="#w01-on-track">on track</a> },
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

  it('sends the rendered plan version with each grade (decision 36)', async () => {
    const user = userEvent.setup()
    const record = vi.fn<RecordOutcome>(async () => SAVED)
    render(
      <CardBlock
        cards={[card(BLOCKER, 'b-new')]}
        items={ROWS}
        requestId={REQUEST_ID}
        record={record}
        planVersion={3}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Xem nghĩa' }))
    await user.click(screen.getByRole('button', { name: /^Biết/ }))
    expect(record).toHaveBeenCalledExactlyOnceWith({
      requestId: REQUEST_ID,
      itemId: BLOCKER.id,
      blockId: 'b-new',
      planVersion: 3,
      outcome: { type: 'item.result', result: 'know' },
    })
  })

  it('sits under the block’s h3: the card front is an h4, "Xem nghĩa" outline (parked #7, m-12)', () => {
    render(
      <CardBlock
        cards={[card(BLOCKER, 'b-new')]}
        items={ROWS}
        requestId={REQUEST_ID}
        record={vi.fn()}
      />,
    )
    expect(screen.getByRole('heading', { level: 4, name: 'blocker' })).toBeTruthy()
    // The block's own primary is its "Check-in" (DESIGN_SYSTEM §9, §12: one primary per view).
    expect(screen.getByRole('button', { name: 'Xem nghĩa' }).getAttribute('data-variant')).toBe(
      'outline',
    )
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

  describe('a block that grows while shown (Học thêm, off-plan results — M5-R33 I-1)', () => {
    it('a finished session takes the appended cards: they are graded inline, no reload', async () => {
      const user = userEvent.setup()
      const record = vi.fn<RecordOutcome>(async () => SAVED)
      const { rerender } = render(
        <CardBlock
          cards={[card(BLOCKER, 'b-extra'), card(UNBLOCK, 'b-extra')]}
          items={ROWS}
          requestId={REQUEST_ID}
          record={record}
        />,
      )
      await user.click(screen.getByRole('button', { name: 'Xem nghĩa' }))
      await user.click(screen.getByRole('button', { name: /^Biết/ }))
      await screen.findByRole('heading', { level: 4, name: 'unblock' })
      await user.click(screen.getByRole('button', { name: 'Xem nghĩa' }))
      await user.click(screen.getByRole('button', { name: /^Biết/ }))
      expect(await screen.findByRole('heading', { name: 'Đã ôn xong' })).toBeTruthy()
      // "Học thêm" appended on track: the revalidated page has one card left to grade.
      rerender(
        <CardBlock
          cards={[card(ON_TRACK, 'b-extra')]}
          items={GROWN}
          requestId="11111111-2222-4333-8444-555555555555"
          record={record}
        />,
      )
      expect(screen.getByText('Còn 1 thẻ')).toBeTruthy()
      expect(screen.getByRole('heading', { level: 4, name: 'on track' })).toBeTruthy()
      await user.click(screen.getByRole('button', { name: 'Xem nghĩa' }))
      await user.click(screen.getByRole('button', { name: /^Chưa chắc/ }))
      expect(record).toHaveBeenLastCalledWith({
        requestId: '11111111-2222-4333-8444-555555555555',
        itemId: ON_TRACK.id,
        blockId: 'b-extra',
        outcome: { type: 'item.result', result: 'unsure' },
      })
    })

    it('a block shown as rows (every card handled) turns into a session for the new cards', async () => {
      const user = userEvent.setup()
      const record = vi.fn<RecordOutcome>(async () => SAVED)
      const { rerender } = render(
        <CardBlock cards={[]} items={ROWS} requestId={REQUEST_ID} record={record} />,
      )
      expect(screen.getAllByRole('link')).toHaveLength(2)
      rerender(
        <CardBlock
          cards={[card(ON_TRACK, 'b-extra')]}
          items={GROWN}
          requestId={REQUEST_ID}
          record={record}
        />,
      )
      expect(screen.queryByRole('link')).toBeNull()
      await user.click(screen.getByRole('button', { name: 'Xem nghĩa' }))
      await user.click(screen.getByRole('button', { name: /^Biết/ }))
      expect(record).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ itemId: ON_TRACK.id, blockId: 'b-extra' }),
      )
    })

    it('mid-session: the current card stays current, and the new cards follow it', async () => {
      const user = userEvent.setup()
      const record = vi.fn<RecordOutcome>(async () => SAVED)
      const { rerender } = render(
        <CardBlock
          cards={[card(BLOCKER, 'b-extra'), card(UNBLOCK, 'b-extra')]}
          items={ROWS}
          requestId={REQUEST_ID}
          record={record}
        />,
      )
      await user.click(screen.getByRole('button', { name: 'Xem nghĩa' }))
      await user.click(screen.getByRole('button', { name: /^Biết/ }))
      expect(await screen.findByRole('heading', { level: 4, name: 'unblock' })).toBeTruthy()
      // Graded blocker is gone from the page's cards; on track was appended.
      rerender(
        <CardBlock
          cards={[card(UNBLOCK, 'b-extra'), card(ON_TRACK, 'b-extra')]}
          items={GROWN}
          requestId={REQUEST_ID}
          record={record}
        />,
      )
      expect(screen.getByRole('heading', { level: 4, name: 'unblock' })).toBeTruthy()
      expect(screen.getByText('Còn 2 thẻ')).toBeTruthy()
      await user.click(screen.getByRole('button', { name: 'Xem nghĩa' }))
      await user.click(screen.getByRole('button', { name: /^Biết/ }))
      expect(await screen.findByRole('heading', { level: 4, name: 'on track' })).toBeTruthy()
      expect(record.mock.calls.map(([input]) => input.itemId)).toEqual([BLOCKER.id, UNBLOCK.id])
    })

    it('keeps the current card revealed when the block grows (parked #8)', async () => {
      const user = userEvent.setup()
      const { rerender } = render(
        <CardBlock
          cards={[card(BLOCKER, 'b-extra'), card(UNBLOCK, 'b-extra')]}
          items={ROWS}
          requestId={REQUEST_ID}
          record={vi.fn()}
        />,
      )
      await user.click(screen.getByRole('button', { name: 'Xem nghĩa' }))
      expect(screen.getByText('vấn đề đang chặn, khiến bạn chưa làm tiếp được')).toBeTruthy()
      rerender(
        <CardBlock
          cards={[card(BLOCKER, 'b-extra'), card(UNBLOCK, 'b-extra'), card(ON_TRACK, 'b-extra')]}
          items={GROWN}
          requestId={REQUEST_ID}
          record={vi.fn()}
        />,
      )
      expect(screen.getByText('Còn 3 thẻ')).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Ẩn nghĩa' })).toBeTruthy()
      expect(screen.getByText('vấn đề đang chặn, khiến bạn chưa làm tiếp được')).toBeTruthy()
      expect(screen.getByRole('button', { name: /^Biết/ })).toBeTruthy()
    })

    it('leaves focus where it is (the "Học thêm" button outside the block)', () => {
      const { rerender } = render(
        <>
          <button type="button">Học thêm</button>
          <CardBlock
            cards={[card(BLOCKER, 'b-extra')]}
            items={ROWS.slice(0, 1)}
            requestId={REQUEST_ID}
            record={vi.fn()}
          />
        </>,
      )
      const outside = screen.getByRole('button', { name: 'Học thêm' })
      outside.focus()
      rerender(
        <>
          <button type="button">Học thêm</button>
          <CardBlock
            cards={[card(BLOCKER, 'b-extra'), card(ON_TRACK, 'b-extra')]}
            items={[ROWS[0]!, GROWN[2]!]}
            requestId={REQUEST_ID}
            record={vi.fn()}
          />
        </>,
      )
      expect(screen.getByText('Còn 2 thẻ')).toBeTruthy()
      expect(document.activeElement).toBe(outside)
    })
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
    expect(within(second).getByRole('heading', { level: 4, name: 'unblock' })).toBeTruthy()
  })
})
