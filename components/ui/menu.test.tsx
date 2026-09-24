import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs'
import { Toaster, toast } from './toaster'
import { ToggleGroup, ToggleGroupItem } from './toggle-group'

describe('DropdownMenu', () => {
  it('opens from the keyboard, lists menu items and closes on Escape', async () => {
    const user = userEvent.setup()
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Tài khoản</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>An</DropdownMenuLabel>
          <DropdownMenuRadioGroup value="light">
            <DropdownMenuRadioItem value="light">Sáng</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark">Tối</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive">Đăng xuất</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    )
    screen.getByRole('button', { name: 'Tài khoản' }).focus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('menu')).toBeTruthy()
    expect(screen.getByRole('menuitemradio', { name: 'Sáng' }).getAttribute('aria-checked')).toBe(
      'true',
    )
    expect(screen.getByRole('menuitem', { name: 'Đăng xuất' }).className).toContain('min-h-11')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
  })
})

describe('Tabs', () => {
  it('moves between tabs with the arrow keys', async () => {
    const user = userEvent.setup()
    render(
      <Tabs defaultValue="python">
        <TabsList>
          <TabsTrigger value="python">Python</TabsTrigger>
          <TabsTrigger value="java">Java</TabsTrigger>
        </TabsList>
        <TabsContent value="python">def</TabsContent>
        <TabsContent value="java">class</TabsContent>
      </Tabs>,
    )
    await user.click(screen.getByRole('tab', { name: 'Python' }))
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Java' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tabpanel').textContent).toBe('class')
  })
})

describe('ToggleGroup', () => {
  it('keeps exactly one choice selected', async () => {
    const user = userEvent.setup()
    render(
      <ToggleGroup type="single" defaultValue="done" aria-label="Trạng thái">
        <ToggleGroupItem value="done">Xong</ToggleGroupItem>
        <ToggleGroupItem value="partial">Một phần</ToggleGroupItem>
        <ToggleGroupItem value="skipped">Bỏ qua</ToggleGroupItem>
      </ToggleGroup>,
    )
    await user.click(screen.getByRole('radio', { name: 'Một phần' }))
    const checked = screen
      .getAllByRole('radio')
      .filter((r) => r.getAttribute('aria-checked') === 'true')
    expect(checked.map((r) => r.textContent)).toEqual(['Một phần'])
  })
})

describe('Toaster', () => {
  it('announces toasts in a region labelled in Vietnamese', async () => {
    render(<Toaster />)
    act(() => {
      toast('Đã lưu')
    })
    expect(await screen.findByText('Đã lưu')).toBeTruthy()
    expect(screen.getByRole('region').getAttribute('aria-label')).toContain('Thông báo')
  })
})
