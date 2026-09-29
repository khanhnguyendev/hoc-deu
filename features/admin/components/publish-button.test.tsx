import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AdminActionResult } from '../actions'
import { PublishButton } from './publish-button'

const toast = vi.hoisted(() => vi.fn())
vi.mock('@/components/ui/toaster', () => ({ toast }))

const PR = 'https://github.com/khanhnguyendev/hoc-deu/pull/41'
const ok = (message: string): AdminActionResult => ({ ok: true, message })

function setup(
  props: Partial<React.ComponentProps<typeof PublishButton>> = {},
): React.ComponentProps<typeof PublishButton> {
  return {
    target: 'dsa:lc-0206#note',
    title: 'Reverse Linked List',
    titleLang: 'en',
    checklist: 'problem',
    request: null,
    requestPublish: vi.fn(async () => ok('Đã ghi yêu cầu xuất bản.')),
    cancelPublish: vi.fn(async () => ok('Đã huỷ yêu cầu xuất bản.')),
    ...props,
  }
}

beforeEach(() => {
  toast.mockReset()
})

const openDialog = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Xuất bản Reverse Linked List' }))
  return screen.getByRole('dialog')
}

describe('PublishButton (§6.6 "Xuất bản")', () => {
  it('names its draft: "Xuất bản <title>"', () => {
    render(<PublishButton {...setup()} />)
    const button = screen.getByRole('button', { name: 'Xuất bản Reverse Linked List' })
    expect(button.textContent).toBe('Xuất bản')
  })

  it('opens the publish checklist: three boxes, the confirm disabled until all are ticked', () => {
    const props = setup()
    render(<PublishButton {...props} />)
    const dialog = openDialog()
    expect(
      within(dialog).getByRole('heading', { name: 'Xuất bản Reverse Linked List?' }),
    ).toBeTruthy()
    const boxes = within(dialog).getAllByRole('checkbox')
    expect(boxes.map((box) => box.getAttribute('aria-checked'))).toEqual([
      'false',
      'false',
      'false',
    ])
    expect(
      within(dialog).getByRole('checkbox', {
        name: 'Các ví dụ trong tests.yaml khớp với ví dụ trên LeetCode.',
      }),
    ).toBeTruthy()
    expect(
      within(dialog).getByRole('checkbox', {
        name: 'Phần giải thích và độ phức tạp đều đúng.',
      }),
    ).toBeTruthy()
    expect(
      within(dialog).getByRole('checkbox', { name: 'Câu song ngữ đọc tự nhiên.' }),
    ).toBeTruthy()
    expect(
      within(dialog).getByRole('group', { name: 'Danh sách kiểm tra trước khi xuất bản' }),
    ).toBeTruthy()

    const confirm = within(dialog).getByRole('button', { name: 'Xuất bản' })
    expect(confirm).toHaveProperty('disabled', true)
    expect(within(dialog).getByText('Đánh dấu đủ ba mục để xuất bản.')).toBeTruthy()
    fireEvent.click(boxes[0]!)
    fireEvent.click(boxes[1]!)
    expect(confirm).toHaveProperty('disabled', true)
    fireEvent.click(boxes[2]!)
    expect(confirm).toHaveProperty('disabled', false)
    expect(within(dialog).queryByText('Đánh dấu đủ ba mục để xuất bản.')).toBeNull()
    // Unticking one disables it again.
    fireEvent.click(boxes[1]!)
    expect(confirm).toHaveProperty('disabled', true)
    expect(props.requestPublish).not.toHaveBeenCalled()
  })

  it('confirms with all three ticked: requests the target and toasts the answer', async () => {
    const props = setup()
    render(<PublishButton {...props} />)
    const dialog = openDialog()
    for (const box of within(dialog).getAllByRole('checkbox')) fireEvent.click(box)
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Xuất bản' }))
    })
    expect(props.requestPublish).toHaveBeenCalledWith('dsa:lc-0206#note')
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Đã ghi yêu cầu xuất bản.'))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('a reopened dialog starts with every box unticked', async () => {
    render(<PublishButton {...setup()} />)
    let dialog = openDialog()
    fireEvent.click(within(dialog).getAllByRole('checkbox')[0]!)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Huỷ' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    dialog = openDialog()
    expect(
      within(dialog)
        .getAllByRole('checkbox')
        .map((box) => box.getAttribute('aria-checked')),
    ).toEqual(['false', 'false', 'false'])
  })

  it('another item type gets the same three checks in its own terms', () => {
    render(<PublishButton {...setup({ checklist: 'item', title: 'Danh sách liên kết' })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Xuất bản Danh sách liên kết' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getAllByRole('checkbox')).toHaveLength(3)
    expect(within(dialog).queryByText(/tests\.yaml/)).toBeNull()
  })

  it('a failed request keeps the dialog open with the failure in its alert region (not a toast alone)', async () => {
    const props = setup({
      requestPublish: vi.fn(async () => ({
        ok: false as const,
        message: 'Không lưu được yêu cầu.',
      })),
    })
    render(<PublishButton {...props} />)
    const dialog = openDialog()
    for (const box of within(dialog).getAllByRole('checkbox')) fireEvent.click(box)
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Xuất bản' }))
    })
    await waitFor(() =>
      expect(within(dialog).getByRole('alert').textContent).toContain('Không lưu được yêu cầu.'),
    )
    expect(screen.getByRole('dialog')).toBe(dialog)
    // The ticks stay: the admin can try again at once.
    for (const box of within(dialog).getAllByRole('checkbox')) {
      expect(box.getAttribute('aria-checked')).toBe('true')
    }
    expect(toast).not.toHaveBeenCalled()
  })

  it('a reopened dialog starts without the last failure', async () => {
    const props = setup({
      requestPublish: vi.fn(async () => ({ ok: false as const, message: 'Không lưu được.' })),
    })
    render(<PublishButton {...props} />)
    let dialog = openDialog()
    for (const box of within(dialog).getAllByRole('checkbox')) fireEvent.click(box)
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Xuất bản' }))
    })
    await waitFor(() => expect(within(dialog).getByRole('alert').textContent).not.toBe(''))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Huỷ' }))
    dialog = openDialog()
    expect(within(dialog).getByRole('alert').textContent).toBe('')
  })

  it('a thrown request says "Không lưu được…" in the dialog', async () => {
    const props = setup({ requestPublish: vi.fn(() => Promise.reject(new Error('offline'))) })
    render(<PublishButton {...props} />)
    const dialog = openDialog()
    for (const box of within(dialog).getAllByRole('checkbox')) fireEvent.click(box)
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Xuất bản' }))
    })
    await waitFor(() =>
      expect(within(dialog).getByRole('alert').textContent).toContain('Không lưu được'),
    )
  })
})

describe('PublishButton — a pending request', () => {
  it('shows "Đang chờ xuất bản" and "Huỷ", without a PR before a publish run', () => {
    const { container } = render(
      <PublishButton {...setup({ request: { requestId: 7, pr: null } })} />,
    )
    expect(screen.getByText('Đang chờ xuất bản')).toBeTruthy()
    expect(screen.queryByRole('link')).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Huỷ yêu cầu xuất bản Reverse Linked List' }).textContent,
    ).toBe('Huỷ')
    expect(screen.queryByRole('button', { name: /^Xuất bản/ })).toBeNull()
    expect(
      container.querySelector('[data-slot="publish-button"]')?.getAttribute('data-state'),
    ).toBe('pending')
  })

  it('links the PR once a publish run included the request (new tab, said so)', () => {
    render(
      <PublishButton
        {...setup({ request: { requestId: 7, pr: { href: PR, label: 'PR #41' } } })}
      />,
    )
    const link = screen.getByRole('link', { name: /PR #41/ })
    expect(link.getAttribute('href')).toBe(PR)
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    expect(link.textContent).toContain('(mở trong tab mới)')
  })

  it('"Huỷ" cancels the request and toasts the answer', async () => {
    const props = setup({ request: { requestId: 7, pr: null } })
    render(<PublishButton {...props} />)
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Huỷ yêu cầu xuất bản Reverse Linked List' }),
      )
    })
    expect(props.cancelPublish).toHaveBeenCalledWith(7)
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Đã huỷ yêu cầu xuất bản.'))
  })

  it('a failed "Huỷ" says why beside the button, in its alert region', async () => {
    const props = setup({
      request: { requestId: 7, pr: null },
      cancelPublish: vi.fn(async () => ({ ok: false as const, message: 'Không huỷ được.' })),
    })
    render(<PublishButton {...props} />)
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Huỷ yêu cầu xuất bản Reverse Linked List' }),
      )
    })
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Không huỷ được.'))
    const cancel = screen.getByRole('button', { name: 'Huỷ yêu cầu xuất bản Reverse Linked List' })
    expect(cancel.getAttribute('aria-describedby')).toBe(
      screen.getByRole('alert').querySelector('[data-slot="form-field-error"]')!.id,
    )
    expect(toast).not.toHaveBeenCalled()
  })

  it('a stale "Huỷ" (merged or cancelled elsewhere) toasts: the page re-renders', async () => {
    const props = setup({
      request: { requestId: 7, pr: null },
      cancelPublish: vi.fn(async () => ({
        ok: false as const,
        message: 'Đã thay đổi.',
        stale: true as const,
      })),
    })
    render(<PublishButton {...props} />)
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Huỷ yêu cầu xuất bản Reverse Linked List' }),
      )
    })
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Đã thay đổi.'))
    expect(screen.getByRole('alert').textContent).toBe('')
  })

  it('the PR link is a 44 px target (md button height, not sm)', () => {
    render(
      <PublishButton
        {...setup({ request: { requestId: 7, pr: { href: PR, label: 'PR #41' } } })}
      />,
    )
    const link = screen.getByRole('link', { name: /PR #41/ })
    expect(link.className).toContain('h-11')
    expect(link.className).not.toContain('h-9')
  })

  it('after "Huỷ", focus waits for the re-render, then moves to "Xuất bản"', async () => {
    const props = setup({ request: { requestId: 7, pr: null } })
    const { rerender } = render(<PublishButton {...props} />)
    const cancel = screen.getByRole('button', { name: 'Huỷ yêu cầu xuất bản Reverse Linked List' })
    cancel.focus()
    await act(async () => {
      fireEvent.click(cancel)
    })
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Đã huỷ yêu cầu xuất bản.'))
    // Still the same request (the page has not re-rendered yet): focus stays put.
    rerender(<PublishButton {...props} />)
    expect(document.activeElement).toBe(cancel)
    rerender(<PublishButton {...props} request={null} />)
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Xuất bản Reverse Linked List' }),
      ),
    )
  })

  it('after "Xuất bản", focus moves to "Huỷ" once the pending request renders', async () => {
    const props = setup()
    const { rerender } = render(<PublishButton {...props} />)
    const dialog = openDialog()
    for (const box of within(dialog).getAllByRole('checkbox')) fireEvent.click(box)
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Xuất bản' }))
    })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    rerender(<PublishButton {...props} request={{ requestId: 9, pr: null }} />)
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Huỷ yêu cầu xuất bản Reverse Linked List' }),
      ),
    )
  })

  it('without the actions (the catalog) it shows the state only', () => {
    render(
      <PublishButton
        {...setup({ request: null, requestPublish: undefined, cancelPublish: undefined })}
      />,
    )
    expect(screen.queryByRole('button')).toBeNull()
  })
})
