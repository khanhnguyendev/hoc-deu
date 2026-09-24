import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeToggle } from '../theme-toggle'
import { AppShell } from '.'

const state = vi.hoisted(() => ({ pathname: '/today', setTheme: vi.fn() }))

vi.mock('next/navigation', () => ({ usePathname: () => state.pathname }))
vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light', resolvedTheme: 'light', setTheme: state.setTheme }),
}))

beforeEach(() => {
  state.pathname = '/today'
  state.setTheme.mockReset()
})

function renderShell(isAdmin = false) {
  return render(
    <AppShell
      user={{ name: 'Nguyễn Văn An' }}
      isAdmin={isAdmin}
      title="Hôm nay"
      onSignOut={() => {}}
    >
      <p>Nội dung</p>
    </AppShell>,
  )
}

const NAV = ['Hôm nay', 'Ôn tập', 'Lộ trình', 'Tiến độ', 'Cài đặt']

describe('AppShell navigation', () => {
  it('shows the five items in the sidebar and the bottom nav', () => {
    renderShell()
    const navs = screen.getAllByRole('navigation', { name: 'Điều hướng chính' })
    expect(navs).toHaveLength(2)
    for (const nav of navs) {
      const names = within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent)
      expect(names).toEqual(expect.arrayContaining(NAV))
    }
  })

  it.each([
    ['/review', 'Ôn tập'],
    ['/t/dsa/items/dsa:lc-0001', 'Lộ trình'],
    ['/settings', 'Cài đặt'],
  ])('marks only the current item on %s', (pathname, current) => {
    state.pathname = pathname
    renderShell()
    for (const nav of screen.getAllByRole('navigation', { name: 'Điều hướng chính' })) {
      const marked = within(nav)
        .getAllByRole('link')
        .filter((link) => link.getAttribute('aria-current') === 'page')
      expect(marked.map((link) => link.textContent)).toEqual([current])
    }
  })

  it('marks the current item with weight and an indicator bar, not colour alone', () => {
    state.pathname = '/review'
    renderShell()
    for (const nav of screen.getAllByRole('navigation', { name: 'Điều hướng chính' })) {
      for (const link of within(nav).getAllByRole('link')) {
        const current = link.getAttribute('aria-current') === 'page'
        expect(link.className.includes('font-semibold'), link.textContent ?? '').toBe(current)
        expect(link.className.includes('before:bg-primary'), link.textContent ?? '').toBe(current)
      }
    }
  })

  it('lists admin links in the sidebar only for admins', () => {
    const { unmount } = renderShell(false)
    expect(screen.queryByRole('link', { name: 'Người dùng' })).toBeNull()
    unmount()
    renderShell(true)
    expect(screen.getByRole('link', { name: 'Người dùng' }).getAttribute('href')).toBe(
      '/admin/users',
    )
  })

  it('collapses the sidebar', async () => {
    renderShell()
    const toggle = screen.getByRole('button', { name: 'Thu gọn thanh bên' })
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    await userEvent.setup().click(toggle)
    expect(
      screen.getByRole('button', { name: 'Mở rộng thanh bên' }).getAttribute('aria-expanded'),
    ).toBe('false')
  })

  it('starts with a skip link to the main content', () => {
    renderShell()
    expect(screen.getByRole('link', { name: 'Bỏ qua đến nội dung' }).getAttribute('href')).toBe(
      '#main',
    )
    expect(screen.getByRole('main').id).toBe('main')
    expect(screen.getByText('Nội dung')).toBeTruthy()
  })

  it('stacks the page sections with the section spacing (DESIGN_SYSTEM §5)', () => {
    renderShell()
    const main = screen.getByRole('main')
    for (const token of ['flex-col', 'gap-6', 'md:gap-8', 'lg:gap-10']) {
      expect(main.className.split(' ')).toContain(token)
    }
  })
})

describe('AccountMenu', () => {
  it.each([
    [false, 0],
    [true, 1],
  ])('isAdmin=%s shows %i admin entries, and switches the theme', async (isAdmin, count) => {
    const user = userEvent.setup()
    renderShell(isAdmin)
    await user.click(screen.getAllByRole('button', { name: 'Tài khoản: Nguyễn Văn An' })[0]!)
    const menu = screen.getByRole('menu')
    expect(within(menu).queryAllByRole('menuitem', { name: 'Quản trị' })).toHaveLength(count)
    expect(within(menu).getByRole('menuitem', { name: 'Đăng xuất' })).toBeTruthy()
    await user.click(within(menu).getByRole('menuitemradio', { name: 'Tối' }))
    expect(state.setTheme).toHaveBeenCalledWith('dark')
  })
})

describe('AccountMenu avatar', () => {
  it('shows an icon instead of an empty avatar for an empty name', () => {
    render(
      <AppShell user={{ name: '' }} isAdmin={false} title="Hôm nay">
        <p>Nội dung</p>
      </AppShell>,
    )
    for (const trigger of screen.getAllByRole('button', { name: /^Tài khoản/ })) {
      expect(trigger.querySelector('svg.lucide-user')).not.toBeNull()
    }
  })
})

describe('ThemeToggle', () => {
  it('sets the chosen theme', async () => {
    render(<ThemeToggle />)
    await userEvent.setup().click(screen.getByRole('radio', { name: 'Theo hệ thống' }))
    expect(state.setTheme).toHaveBeenCalledWith('system')
  })
})
