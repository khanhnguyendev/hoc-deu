import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog'
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from './sheet'

function DialogExample() {
  return (
    <Dialog>
      <DialogTrigger>Check-in</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Check-in khối học</DialogTitle>
          <DialogDescription>Chọn trạng thái.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <button type="button">Lưu</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

describe('Dialog', () => {
  it('traps focus, closes on Escape and restores focus to the trigger', async () => {
    const user = userEvent.setup()
    render(<DialogExample />)
    const trigger = screen.getByRole('button', { name: 'Check-in' })
    await user.click(trigger)

    const dialog = screen.getByRole('dialog', { name: 'Check-in khối học' })
    expect(dialog.contains(document.activeElement)).toBe(true)
    for (let i = 0; i < 4; i++) {
      await user.tab()
      expect(dialog.contains(document.activeElement)).toBe(true)
    }

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('labels its close button in Vietnamese', async () => {
    const user = userEvent.setup()
    render(<DialogExample />)
    await user.click(screen.getByRole('button', { name: 'Check-in' }))
    await user.click(screen.getByRole('button', { name: 'Đóng' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('Sheet', () => {
  it.each([
    [undefined, 'bottom'],
    ['right', 'right'],
  ] as const)('opens from side %s', async (side, expected) => {
    const user = userEvent.setup()
    render(
      <Sheet>
        <SheetTrigger>Mở</SheetTrigger>
        <SheetContent side={side}>
          <SheetTitle>Bộ lọc</SheetTitle>
          <SheetDescription>Lọc theo trạng thái.</SheetDescription>
        </SheetContent>
      </Sheet>,
    )
    await user.click(screen.getByRole('button', { name: 'Mở' }))
    const sheet = screen.getByRole('dialog', { name: 'Bộ lọc' })
    expect(sheet.dataset.side).toBe(expected)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
