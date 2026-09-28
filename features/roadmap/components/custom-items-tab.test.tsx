import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CustomItemsTab, type CustomItemsTabData } from './custom-items-tab'
import { TrackTabs } from './track-tabs'

const toasts = vi.hoisted(() => [] as string[])
vi.mock('@/components/ui/toaster', () => ({
  toast: (message: string) => {
    toasts.push(message)
  },
}))

const REQUEST_ID = 'c0ffee00-1234-4abc-8def-0123456789ab'
const ACTIVE = 'user:0123456789abcdef:on-hold'
const HIDDEN = 'user:0123456789abcdef:blocker'

const rowOf = (title: string) => (
  <a href={`/t/english/items/${encodeURIComponent(title)}`}>{title}</a>
)
const READY: CustomItemsTabData = {
  state: 'ready',
  items: [
    { itemId: ACTIVE, title: 'on hold', row: rowOf('on hold'), hidden: false },
    { itemId: HIDDEN, title: 'blocker', row: rowOf('blocker'), hidden: true },
  ],
}

beforeEach(() => {
  toasts.length = 0
})

describe('CustomItemsTab ("Mục riêng", §2.4)', () => {
  const hide = vi.fn(async () => ({ ok: true, message: 'Đã ẩn mục này.' }))

  it('renders nothing without items (the page shows no tab)', () => {
    const { container } = render(
      <CustomItemsTab data={{ state: 'ready', items: [] }} hide={hide} requestId={REQUEST_ID} />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('lists the items, a link to each page; an active one has "Ẩn", a hidden one says "Đã ẩn"', () => {
    render(<CustomItemsTab data={READY} hide={hide} requestId={REQUEST_ID} />)
    const list = screen.getByRole('list', { name: 'Mục riêng' })
    const [active, hidden] = within(list).getAllByRole('listitem')
    expect(within(active!).getByRole('link', { name: 'on hold' })).toBeTruthy()
    expect(within(active!).getByRole('button', { name: 'Ẩn on hold' })).toBeTruthy()
    expect(within(active!).queryByText('Đã ẩn')).toBeNull()
    expect(within(hidden!).getByRole('link', { name: 'blocker' })).toBeTruthy()
    expect(within(hidden!).getByText('Đã ẩn')).toBeTruthy()
    expect(within(hidden!).queryByRole('button')).toBeNull()
  })

  it('"Ẩn" asks first; confirming sends the render’s request id and the item', async () => {
    const user = userEvent.setup()
    const action = vi.fn(async () => ({ ok: true, message: 'Đã ẩn mục này.' }))
    render(<CustomItemsTab data={READY} hide={action} requestId={REQUEST_ID} />)
    await user.click(screen.getByRole('button', { name: 'Ẩn on hold' }))
    const dialog = screen.getByRole('alertdialog', { name: 'Ẩn mục này?' })
    expect(dialog.textContent).toContain('Mục này sẽ không xuất hiện trong kế hoạch từ ngày mai.')
    await user.click(within(dialog).getByRole('button', { name: 'Ẩn' }))
    expect(action).toHaveBeenCalledExactlyOnceWith({ requestId: REQUEST_ID, itemId: ACTIVE })
    expect(await screen.findByText('Đã ẩn mục này.')).toBeTruthy()
  })

  it('cancelling sends nothing', async () => {
    const user = userEvent.setup()
    const action = vi.fn(async () => ({ ok: true, message: '' }))
    render(<CustomItemsTab data={READY} hide={action} requestId={REQUEST_ID} />)
    await user.click(screen.getByRole('button', { name: 'Ẩn on hold' }))
    await user.click(screen.getByRole('button', { name: 'Huỷ' }))
    expect(action).not.toHaveBeenCalled()
  })

  it('the error state: what failed, the rest of the page unaffected', () => {
    render(<CustomItemsTab data={{ state: 'error' }} hide={hide} requestId={REQUEST_ID} />)
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('Không đọc được mục riêng')
  })
})

describe('TrackTabs', () => {
  it('shows the roadmap first; "Mục riêng" switches to the custom items, by keyboard too', async () => {
    const user = userEvent.setup()
    render(<TrackTabs roadmap={<p>Tuần 1</p>} custom={<p>on hold</p>} />)
    expect(screen.getByRole('tablist', { name: 'Nội dung lộ trình' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Lộ trình', selected: true })).toBeTruthy()
    expect(screen.getByText('Tuần 1')).toBeTruthy()
    expect(screen.queryByText('on hold')).toBeNull()
    await user.click(screen.getByRole('tab', { name: 'Mục riêng' }))
    expect(screen.getByRole('tabpanel').textContent).toBe('on hold')
    await user.keyboard('{ArrowLeft}')
    expect(screen.getByRole('tab', { name: 'Lộ trình', selected: true })).toBeTruthy()
  })

  it('opens on the custom items when asked (`?tab=custom`)', () => {
    render(<TrackTabs roadmap={<p>Tuần 1</p>} custom={<p>on hold</p>} initial="custom" />)
    expect(screen.getByRole('tabpanel').textContent).toBe('on hold')
  })
})
