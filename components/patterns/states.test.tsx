import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Inbox } from 'lucide-react'
import { useState } from 'react'
import { describe, expect, it, vi as mock } from 'vitest'
import { Banner } from './banner'
import { ConfirmDialog } from './confirm-dialog'
import { DataList } from './data-list'
import { DataState } from './data-state'
import { EmptyState } from './empty-state'
import { ErrorState } from './error-state'
import { LoadingState } from './loading-state'

const empty = <EmptyState icon={Inbox} title="Chưa có thẻ nào" />

describe('DataState', () => {
  it('renders the loading state', () => {
    render(
      <DataState state={{ status: 'loading' }} empty={empty}>
        {() => null}
      </DataState>,
    )
    expect(screen.getByRole('status').textContent).toContain('Đang tải…')
  })

  it('renders the empty state', () => {
    render(
      <DataState state={{ status: 'empty' }} empty={empty}>
        {() => null}
      </DataState>,
    )
    expect(screen.getByText('Chưa có thẻ nào')).toBeTruthy()
  })

  it('renders the error state with a retry that calls back', async () => {
    const retry = mock.fn()
    render(
      <DataState state={{ status: 'error', retry }} empty={empty}>
        {() => null}
      </DataState>,
    )
    expect(screen.getByText('Không tải được dữ liệu')).toBeTruthy()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(retry).toHaveBeenCalledOnce()
  })

  it('renders the data when ready', () => {
    render(
      <DataState state={{ status: 'ready', data: ['a', 'b'] }} empty={empty}>
        {(items) => <p>{items.join(',')}</p>}
      </DataState>,
    )
    expect(screen.getByText('a,b')).toBeTruthy()
  })
})

describe('EmptyState', () => {
  it('links to the next step', () => {
    render(<EmptyState icon={Inbox} title="Trống" action={{ label: 'Về trang chủ', href: '/' }} />)
    expect(screen.getByRole('link', { name: 'Về trang chủ' }).getAttribute('href')).toBe('/')
  })

  it('offers a button action', async () => {
    const onClick = mock.fn()
    render(<EmptyState icon={Inbox} title="Trống" action={{ label: 'Tạo mới', onClick }} />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Tạo mới' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('can be the page heading', () => {
    render(<EmptyState icon={Inbox} title="Không tìm thấy trang" titleAs="h1" layout="page" />)
    expect(screen.getByRole('heading', { level: 1, name: 'Không tìm thấy trang' })).toBeTruthy()
    expect(screen.getByRole('main')).toBeTruthy()
  })
})

describe('ErrorState and LoadingState', () => {
  it('is announced as an alert when it appears', () => {
    render(<ErrorState />)
    expect(screen.getByRole('alert').textContent).toContain('Không tải được dữ liệu')
  })

  it('uses the default title and hides retry without a handler', () => {
    render(<ErrorState />)
    expect(screen.getByText('Không tải được dữ liệu')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it.each(['list', 'card', 'page'] as const)(
    '%s skeletons are hidden from screen readers',
    (variant) => {
      const { container } = render(<LoadingState variant={variant} />)
      const skeletons = container.querySelectorAll('[data-slot="skeleton"]')
      expect(skeletons.length).toBeGreaterThan(0)
      for (const s of skeletons) expect(s.getAttribute('aria-hidden')).toBe('true')
    },
  )
})

describe('ConfirmDialog', () => {
  it('confirms, and blocks a second action while pending', async () => {
    const onConfirm = mock.fn()
    const props = {
      open: true,
      onOpenChange: () => {},
      title: 'Xoá tài khoản?',
      description: 'Không thể hoàn tác.',
      confirmLabel: 'Xoá',
      tone: 'destructive' as const,
      onConfirm,
    }
    const { rerender } = render(<ConfirmDialog {...props} />)
    expect(screen.getByRole('alertdialog', { name: 'Xoá tài khoản?' })).toBeTruthy()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Xoá' }))
    expect(onConfirm).toHaveBeenCalledOnce()

    rerender(<ConfirmDialog {...props} pending />)
    expect(screen.getByRole('button', { name: 'Xoá' }).getAttribute('aria-busy')).toBe('true')
    expect(screen.getByRole('button', { name: 'Huỷ' })).toHaveProperty('disabled', true)
  })
})

describe('ConfirmDialog as an alert dialog', () => {
  const base = {
    open: true,
    title: 'Xoá tài khoản?',
    description: 'Không thể hoàn tác.',
    confirmLabel: 'Xoá',
    tone: 'destructive' as const,
  }

  it('does not close on an outside click', async () => {
    const onOpenChange = mock.fn()
    render(<ConfirmDialog {...base} onOpenChange={onOpenChange} onConfirm={() => {}} />)
    const overlay = document.querySelector<HTMLElement>('[data-slot="dialog-overlay"]')!
    await userEvent.setup().click(overlay)
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(screen.getByRole('alertdialog')).toBeTruthy()
  })

  it('keeps focus inside and ignores repeat clicks and Escape while pending', async () => {
    const user = userEvent.setup()
    const onConfirm = mock.fn()
    const onOpenChange = mock.fn()
    const props = { ...base, onOpenChange, onConfirm }
    const { rerender } = render(<ConfirmDialog {...props} />)
    const confirm = screen.getByRole('button', { name: 'Xoá' })
    await user.click(confirm)
    rerender(<ConfirmDialog {...props} pending />)

    // Still focusable (aria-disabled, not disabled), so focus never falls to <body>.
    expect(confirm).toHaveProperty('disabled', false)
    expect(confirm.getAttribute('aria-disabled')).toBe('true')
    expect(screen.getByRole('alertdialog').contains(document.activeElement)).toBe(true)

    await user.click(confirm)
    await user.keyboard('{Escape}')
    expect(onConfirm).toHaveBeenCalledOnce()
    expect(onOpenChange).not.toHaveBeenCalled()
  })
})

describe('ConfirmDialog focus on close', () => {
  const base = {
    title: 'Xoá tài khoản?',
    description: 'Không thể hoàn tác.',
    confirmLabel: 'Xoá',
    onConfirm: () => {},
  }

  /** A controlled dialog opened from a button, as its consumers use it (no DialogTrigger). */
  function Opener({ onCloseAutoFocus }: { onCloseAutoFocus?: (event: Event) => void }) {
    const [open, setOpen] = useState(false)
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Mở
        </button>
        <button type="button">Khác</button>
        <ConfirmDialog
          {...base}
          open={open}
          onOpenChange={setOpen}
          onCloseAutoFocus={onCloseAutoFocus}
        />
      </>
    )
  }

  it('returns focus to the control that opened it (WCAG 2.4.3)', async () => {
    const user = userEvent.setup()
    render(<Opener />)
    const opener = screen.getByRole('button', { name: 'Mở' })
    await user.click(opener)
    await user.click(await screen.findByRole('button', { name: 'Huỷ' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(opener))
  })

  it('leaves focus to onCloseAutoFocus when it prevents the default', async () => {
    const user = userEvent.setup()
    render(
      <Opener
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          screen.getByRole('button', { name: 'Khác' }).focus()
        }}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Mở' }))
    await user.click(await screen.findByRole('button', { name: 'Huỷ' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Khác' })),
    )
  })
})

describe('DataList', () => {
  it('renders one 44 px row per item', () => {
    render(
      <DataList
        label="Bài tập"
        items={[
          { id: 'a', t: 'Two Sum' },
          { id: 'b', t: 'Valid Anagram' },
        ]}
        getKey={(i) => i.id}
        renderItem={(i) => i.t}
        empty={empty}
      />,
    )
    const rows = screen.getAllByRole('listitem')
    expect(rows.map((r) => r.textContent)).toEqual(['Two Sum', 'Valid Anagram'])
    expect(rows[0]?.className).toContain('min-h-11')
  })

  it('renders the empty state for no items', () => {
    render(<DataList items={[]} getKey={String} renderItem={String} empty={empty} />)
    expect(screen.queryByRole('list')).toBeNull()
    expect(screen.getByText('Chưa có thẻ nào')).toBeTruthy()
  })
})

describe('Banner', () => {
  it.each([
    ['warning', 'lucide-triangle-alert'],
    ['danger', 'lucide-circle-alert'],
    ['info', 'lucide-info'],
  ] as const)('%s banner shows its icon, message and action', (tone, icon) => {
    const { container } = render(
      <Banner tone={tone} action={<button type="button">Học tiếp</button>}>
        Lộ trình đang tạm dừng.
      </Banner>,
    )
    expect(container.querySelector(`svg.${icon}`)?.getAttribute('aria-hidden')).toBe('true')
    expect(screen.getByText('Lộ trình đang tạm dừng.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Học tiếp' })).toBeTruthy()
  })
})
