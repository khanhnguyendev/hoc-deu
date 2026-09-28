import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AiOverrides, type AiOverrideView } from './ai-overrides'

const REQUEST_ID = '0f8d6a52-3b1c-4d7e-9a2f-6c5b4e3d2a10'
const DSA = 'Cấu trúc dữ liệu & Giải thuật'
const INSERT: AiOverrideView = {
  trackId: 'dsa',
  key: 'ah-extra-practice',
  trackTitle: DSA,
  text: 'Thêm 15 phút luyện Arrays & Hashing vào T2, T4, T6 đến 19/10',
  suspended: false,
}
const EXTRA: AiOverrideView = {
  trackId: 'dsa',
  key: 'ah-extra-week',
  trackTitle: DSA,
  text: 'Một tuần luyện thêm chủ đề Arrays & Hashing: còn 3 ngày học',
  suspended: false,
}
const REORDER: AiOverrideView = {
  trackId: 'dsa',
  key: 'order',
  trackTitle: DSA,
  text: 'Đổi thứ tự các chủ đề sắp tới',
  suspended: true,
}
const noop = vi.fn(async () => ({ ok: true, message: '' }))

describe('AiOverrides ("Điều chỉnh lộ trình bởi AI", §5.12)', () => {
  it('lists each override with its track, its line and "Thu hồi"', () => {
    render(
      <AiOverrides
        overrides={[INSERT, EXTRA, REORDER]}
        requestId={REQUEST_ID}
        revokeAiOverride={noop}
      />,
    )
    expect(screen.getByRole('heading', { name: 'Điều chỉnh lộ trình bởi AI' })).toBeTruthy()
    const rows = within(
      screen.getByRole('list', { name: 'Điều chỉnh lộ trình bởi AI' }),
    ).getAllByRole('listitem')
    expect(rows).toHaveLength(3)
    for (const [row, view] of [
      [rows[0]!, INSERT],
      [rows[1]!, EXTRA],
      [rows[2]!, REORDER],
    ] as const) {
      expect(row.textContent).toContain(view.text)
      expect(row.textContent).toContain(DSA)
      expect(within(row).getByRole('button', { name: `Thu hồi: ${view.text}` })).toBeTruthy()
    }
  })

  it('marks a suspended override with a labelled badge (never colour alone)', () => {
    render(
      <AiOverrides overrides={[INSERT, REORDER]} requestId={REQUEST_ID} revokeAiOverride={noop} />,
    )
    const rows = screen.getAllByRole('listitem')
    expect(rows[0]!.textContent).not.toContain('Tạm dừng')
    expect(rows[1]!.textContent).toContain('Tạm dừng (đã tắt cá nhân hoá AI)')
  })

  it('renders nothing without an override (the section is hidden)', () => {
    const { container } = render(
      <AiOverrides overrides={[]} requestId={REQUEST_ID} revokeAiOverride={noop} />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('the error state: the section says the list could not be read', () => {
    render(<AiOverrides overrides={null} requestId={REQUEST_ID} revokeAiOverride={noop} />)
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('Không tải được các điều chỉnh lộ trình')
  })

  it('"Thu hồi" asks first; confirming sends the render’s request id, the track and the key', async () => {
    const user = userEvent.setup()
    const action = vi.fn(async () => ({
      ok: true,
      message: 'Đã thu hồi. Thay đổi có hiệu lực từ kế hoạch ngày mai.',
    }))
    render(<AiOverrides overrides={[INSERT]} requestId={REQUEST_ID} revokeAiOverride={action} />)
    await user.click(screen.getByRole('button', { name: `Thu hồi: ${INSERT.text}` }))
    const dialog = screen.getByRole('alertdialog', { name: 'Thu hồi điều chỉnh này?' })
    expect(dialog.textContent).toContain('Thay đổi có hiệu lực từ kế hoạch ngày mai.')
    await user.click(within(dialog).getByRole('button', { name: 'Thu hồi' }))
    expect(action).toHaveBeenCalledExactlyOnceWith({
      requestId: REQUEST_ID,
      trackId: 'dsa',
      key: 'ah-extra-practice',
    })
    expect(
      await screen.findByText('Đã thu hồi. Thay đổi có hiệu lực từ kế hoạch ngày mai.'),
    ).toBeTruthy()
  })

  it('cancelling sends nothing', async () => {
    const user = userEvent.setup()
    const action = vi.fn(async () => ({ ok: true, message: '' }))
    render(<AiOverrides overrides={[INSERT]} requestId={REQUEST_ID} revokeAiOverride={action} />)
    await user.click(screen.getByRole('button', { name: `Thu hồi: ${INSERT.text}` }))
    await user.click(screen.getByRole('button', { name: 'Huỷ' }))
    expect(action).not.toHaveBeenCalled()
  })
})
